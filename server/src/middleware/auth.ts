import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { config } from '../lib/config.js';

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

function verifyJwt(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as AuthUser;
    return { id: payload.id, username: payload.username };
  } catch {
    return null;
  }
}

/** Best-effort JWT auth — sets req.user if a valid JWT is present, never rejects. */
export function tryAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    const token = extractToken(req);
    if (token && !token.startsWith('sk_openbin_')) {
      const user = verifyJwt(token);
      if (user) {
        req.user = user;
        req.authMethod = 'jwt';
      }
    }
  }
  next();
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  if (req.user) { next(); return; }

  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'No token provided' });
    return;
  }

  // API key path
  if (token.startsWith('sk_openbin_')) {
    const keyHash = crypto.createHash('sha256').update(token).digest('hex');
    query(
      `SELECT ak.id AS key_id, u.id, u.username
       FROM api_keys ak
       JOIN users u ON u.id = ak.user_id
       WHERE ak.key_hash = $1 AND ak.revoked_at IS NULL`,
      [keyHash]
    ).then((result) => {
      if (result.rows.length === 0) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid API key' });
        return;
      }
      const row = result.rows[0] as { key_id: string; id: string; username: string };
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
  const user = verifyJwt(token);
  if (user) {
    req.user = user;
    req.authMethod = 'jwt';
    next();
  } else {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token' });
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ id: user.id, username: user.username }, config.jwtSecret, { expiresIn: config.accessTokenExpiresIn as unknown as import('ms').StringValue });
}
