import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  // Auto-generate and persist to disk so tokens survive restarts
  const secretPath = path.join(process.env.PHOTO_STORAGE_PATH || '/data/photos', '..', '.jwt_secret');
  try {
    return fs.readFileSync(secretPath, 'utf-8').trim();
  } catch {
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
    console.log('Generated JWT secret at', secretPath);
    return generated;
  }
}

const JWT_SECRET: string = resolveJwtSecret();

export interface AuthUser {
  id: string;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      authMethod?: 'jwt' | 'api_key';
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;

  let token: string | undefined;
  if (header?.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (queryToken) {
    token = queryToken;
  }

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
      // Fire-and-forget: update last_used_at
      query("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = $1", [row.key_id]).catch(() => {});
      next();
    }).catch(() => {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication failed' });
    });
    return;
  }

  // JWT path
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = { id: payload.id, username: payload.username };
    req.authMethod = 'jwt';
    next();
  } catch {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token' });
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}
