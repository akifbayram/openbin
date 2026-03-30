import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import * as jose from 'jose';
import { query } from '../db.js';
import { config } from '../lib/config.js';

const JWT_SECRET_KEY = new TextEncoder().encode(config.jwtSecret);

export interface AuthUser {
  id: string;
  username: string;
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

async function verifyJwt(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET_KEY, { algorithms: ['HS256'] });
    return { id: payload.id as string, username: payload.username as string };
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
        }
        next();
      }).catch(() => next());
      return;
    }
  }
  next();
}

// Short-lived cache so soft-delete checks don't hit the DB on every request.
// Soft-deletes are rare admin actions; 60 s staleness is acceptable.
const deletedCache = new Map<string, { deleted: boolean; expires: number }>();
const DELETED_CACHE_TTL = 60_000;

function checkSoftDeleted(userId: string): Promise<boolean> {
  const cached = deletedCache.get(userId);
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.deleted);

  return query<{ deleted_at: string | null }>(
    'SELECT deleted_at FROM users WHERE id = $1',
    [userId],
  ).then((result) => {
    const deleted = result.rows.length === 0 || result.rows[0].deleted_at !== null;
    deletedCache.set(userId, { deleted, expires: Date.now() + DELETED_CACHE_TTL });
    return deleted;
  });
}

/** Call after soft-deleting a user so the next request sees it immediately. */
export function invalidateDeletedCache(userId: string): void {
  deletedCache.delete(userId);
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  if (req.user) {
    checkSoftDeleted(req.user.id).then((deleted) => {
      if (deleted) {
        req.user = undefined;
        req.authMethod = undefined;
        res.status(401).json({ error: 'ACCOUNT_DELETED', message: 'This account has been deleted' });
        return;
      }
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
      `SELECT ak.id AS key_id, u.id, u.username, u.deleted_at, u.plan
       FROM api_keys ak
       JOIN users u ON u.id = ak.user_id
       WHERE ak.key_hash = $1 AND ak.revoked_at IS NULL`,
      [keyHash]
    ).then((result) => {
      if (result.rows.length === 0) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid API key' });
        return;
      }
      const row = result.rows[0] as { key_id: string; id: string; username: string; deleted_at: string | null; plan: number };
      if (row.deleted_at) {
        res.status(401).json({ error: 'ACCOUNT_DELETED', message: 'This account has been deleted' });
        return;
      }
      if (!config.selfHosted && row.plan === 0) {
        res.status(403).json({ error: 'PLAN_RESTRICTED', message: 'API key access requires a Pro plan' });
        return;
      }
      req.user = { id: row.id, username: row.username };
      req.authMethod = 'api_key';
      req.apiKeyId = row.key_id;
      // Fire-and-forget: update last_used_at + daily usage counter
      query("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = $1", [row.key_id]).catch(() => {});
      query("INSERT INTO api_key_daily_usage (api_key_id, date) VALUES ($1, date('now')) ON CONFLICT(api_key_id, date) DO UPDATE SET request_count = request_count + 1", [row.key_id]).catch(() => {});
      next();
    }).catch(() => {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication failed' });
    });
    return;
  }

  // JWT path
  verifyJwt(token).then((user) => {
    if (user) {
      checkSoftDeleted(user.id).then((deleted) => {
        if (deleted) {
          res.status(401).json({ error: 'ACCOUNT_DELETED', message: 'This account has been deleted' });
          return;
        }
        req.user = user;
        req.authMethod = 'jwt';
        next();
      }).catch(next);
    } else {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token' });
    }
  });
}

export async function signToken(user: AuthUser): Promise<string> {
  return new jose.SignJWT({ id: user.id, username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(config.accessTokenExpiresIn)
    .sign(JWT_SECRET_KEY);
}
