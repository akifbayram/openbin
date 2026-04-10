import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import * as jose from 'jose';
import { d, query } from '../db.js';
import { config } from '../lib/config.js';
import { Plan } from '../lib/planGate.js';

const JWT_SECRET_KEY = new TextEncoder().encode(config.jwtSecret);

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      authMethod?: 'jwt' | 'api_key';
      apiKeyId?: string;
    }
  }
}

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  const cookie = req.cookies?.['openbin-access'] as string | undefined;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return cookie;
}

interface JwtPayload {
  id: string;
  email: string;
  tv?: number; // token_version
}

async function verifyJwt(token: string): Promise<(AuthUser & { tokenVersion: number }) | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET_KEY, { algorithms: ['HS256'] });
    const p = payload as unknown as JwtPayload;
    return { id: p.id, email: p.email, tokenVersion: p.tv ?? 0 };
  } catch {
    return null;
  }
}

/** Best-effort JWT auth — sets req.user if a valid JWT is present, never rejects. */
export function tryAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    const token = extractToken(req);
    if (token && !token.startsWith('sk_openbin_')) {
      verifyJwt(token).then((user) => {
        if (user) {
          req.user = user;
          req.authMethod = 'jwt';
          maybeUpdateLastActive(user.id);
        }
        next();
      }).catch(() => next());
      return;
    }
  }
  next();
}

// Short-lived cache so status checks don't hit the DB on every request.
// Soft-deletes/suspensions are rare admin actions; 60 s staleness is acceptable.
const deletedCache = new Map<string, { status: 'ok' | 'deleted' | 'suspended'; tokenVersion: number; expires: number }>();
const DELETED_CACHE_TTL = 60_000;

// Debounce last_active_at writes to once per 5 minutes per user
const LAST_ACTIVE_DEBOUNCE_MS = 5 * 60 * 1000;
const LAST_ACTIVE_CACHE_MAX = 10_000;
const lastActiveCache = new Map<string, number>();

function maybeUpdateLastActive(userId: string): void {
  const now = Date.now();
  const lastWrite = lastActiveCache.get(userId);
  if (lastWrite && now - lastWrite < LAST_ACTIVE_DEBOUNCE_MS) return;
  if (lastActiveCache.size >= LAST_ACTIVE_CACHE_MAX) lastActiveCache.clear();
  lastActiveCache.set(userId, now);
  query(`UPDATE users SET last_active_at = ${d.now()} WHERE id = $1`, [userId]).catch(() => {});
}

interface UserStatusRow {
  deleted_at: string | null;
  suspended_at: string | null;
  token_version: number;
}

type UserStatus = 'ok' | 'deleted' | 'suspended';

function checkUserStatus(userId: string): Promise<{ status: UserStatus; tokenVersion: number }> {
  const cached = deletedCache.get(userId);
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached);

  return query<UserStatusRow>(
    'SELECT deleted_at, suspended_at, token_version FROM users WHERE id = $1',
    [userId],
  ).then((result) => {
    if (result.rows.length === 0) {
      const entry = { status: 'deleted' as const, tokenVersion: 0, expires: Date.now() + DELETED_CACHE_TTL };
      deletedCache.set(userId, entry);
      return entry;
    }
    const row = result.rows[0];
    let status: UserStatus = 'ok';
    if (row.deleted_at !== null) status = 'deleted';
    else if (row.suspended_at !== null) status = 'suspended';
    const entry = { status, tokenVersion: row.token_version ?? 0, expires: Date.now() + DELETED_CACHE_TTL };
    deletedCache.set(userId, entry);
    return entry;
  });
}

/** Call after soft-deleting a user so the next request sees it immediately. */
export function invalidateDeletedCache(userId: string): void {
  deletedCache.delete(userId);
}

function handleUserStatus(
  res: Response,
  status: 'ok' | 'deleted' | 'suspended',
  req: Request,
): boolean {
  if (status === 'deleted') {
    req.user = undefined;
    req.authMethod = undefined;
    res.status(401).json({ error: 'ACCOUNT_DELETED', message: 'This account has been deleted' });
    return true;
  }
  if (status === 'suspended') {
    req.user = undefined;
    req.authMethod = undefined;
    res.status(403).json({ error: 'ACCOUNT_SUSPENDED', message: 'This account has been suspended' });
    return true;
  }
  return false;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  if (req.user) {
    const userId = req.user.id;
    checkUserStatus(userId).then(({ status }) => {
      if (handleUserStatus(res, status, req)) return;
      maybeUpdateLastActive(userId);
      next();
    }).catch(next);
    return;
  }

  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'No token provided' });
    return;
  }

  // API key path
  if (token.startsWith('sk_openbin_')) {
    const keyHash = crypto.createHash('sha256').update(token).digest('hex');
    query(
      `SELECT ak.id AS key_id, u.id, u.email, u.deleted_at, u.suspended_at, u.plan
       FROM api_keys ak
       JOIN users u ON u.id = ak.user_id
       WHERE ak.key_hash = $1 AND ak.revoked_at IS NULL`,
      [keyHash]
    ).then((result) => {
      if (result.rows.length === 0) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid API key' });
        return;
      }
      const row = result.rows[0] as { key_id: string; id: string; email: string; deleted_at: string | null; suspended_at: string | null; plan: number };
      if (row.deleted_at) {
        res.status(401).json({ error: 'ACCOUNT_DELETED', message: 'This account has been deleted' });
        return;
      }
      if (row.suspended_at) {
        res.status(403).json({ error: 'ACCOUNT_SUSPENDED', message: 'This account has been suspended' });
        return;
      }
      if (!config.selfHosted && row.plan !== Plan.PRO) {
        res.status(403).json({ error: 'PLAN_RESTRICTED', message: 'API key access requires a Pro plan' });
        return;
      }
      req.user = { id: row.id, email: row.email };
      req.authMethod = 'api_key';
      req.apiKeyId = row.key_id;
      maybeUpdateLastActive(row.id);
      // Fire-and-forget: update last_used_at + daily usage counter
      query(`UPDATE api_keys SET last_used_at = ${d.now()} WHERE id = $1`, [row.key_id]).catch(() => {});
      query(`INSERT INTO api_key_daily_usage (api_key_id, date) VALUES ($1, ${d.today()}) ON CONFLICT(api_key_id, date) DO UPDATE SET request_count = request_count + 1`, [row.key_id]).catch(() => {});
      next();
    }).catch(() => {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication failed' });
    });
    return;
  }

  // JWT path
  verifyJwt(token).then((user) => {
    if (user) {
      checkUserStatus(user.id).then(({ status, tokenVersion }) => {
        if (handleUserStatus(res, status, req)) return;
        // Check token_version — if the token was issued before a revocation, reject it
        if (user.tokenVersion < tokenVersion) {
          res.status(401).json({ error: 'SESSION_REVOKED', message: 'Session has been revoked. Please log in again.' });
          return;
        }
        req.user = { id: user.id, email: user.email };
        req.authMethod = 'jwt';
        maybeUpdateLastActive(user.id);
        next();
      }).catch(next);
    } else {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token' });
    }
  });
}

export async function signToken(user: AuthUser, tokenVersion = 0): Promise<string> {
  return new jose.SignJWT({ id: user.id, email: user.email, tv: tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(config.accessTokenExpiresIn)
    .sign(JWT_SECRET_KEY);
}

/** Invalidate the user status cache (call after suspension, deletion, or token_version bump). */
export function invalidateUserStatusCache(userId: string): void {
  deletedCache.delete(userId);
}
