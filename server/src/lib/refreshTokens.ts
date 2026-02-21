import crypto from 'crypto';
import { query, generateUuid, getDb } from '../db.js';
import { config } from './config.js';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateRawToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export interface RefreshTokenResult {
  rawToken: string;
  familyId: string;
}

/** Create a new refresh token for a user (starts a new rotation family). */
export async function createRefreshToken(userId: string): Promise<RefreshTokenResult> {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const familyId = generateUuid();
  const id = generateUuid();
  const expiresAt = new Date(Date.now() + config.refreshTokenMaxDays * 24 * 60 * 60 * 1000).toISOString();

  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, tokenHash, familyId, expiresAt],
  );

  return { rawToken, familyId };
}

/**
 * Rotate a refresh token: validate the old one, revoke it, and issue a new one in the same family.
 * If the old token was already revoked (replay attack), revokes the entire family.
 */
export async function rotateRefreshToken(rawToken: string): Promise<{ userId: string; rawToken: string } | null> {
  const tokenHash = hashToken(rawToken);

  const result = await query<{
    id: string;
    user_id: string;
    family_id: string;
    expires_at: string;
    revoked_at: string | null;
  }>(
    `SELECT id, user_id, family_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash],
  );

  if (result.rows.length === 0) return null;

  const existing = result.rows[0];

  // Replay detection: if already revoked, revoke the entire family
  if (existing.revoked_at) {
    await query(
      `UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE family_id = $1 AND revoked_at IS NULL`,
      [existing.family_id],
    );
    return null;
  }

  // Check expiry
  if (new Date(existing.expires_at) < new Date()) {
    await query(`UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE id = $1`, [existing.id]);
    return null;
  }

  // Atomically revoke old token and issue new one in the same family
  const newRawToken = generateRawToken();
  const newTokenHash = hashToken(newRawToken);
  const newId = generateUuid();
  const expiresAt = new Date(Date.now() + config.refreshTokenMaxDays * 24 * 60 * 60 * 1000).toISOString();

  const db = getDb();
  const revokeStmt = db.prepare(`UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE id = ?`);
  const insertStmt = db.prepare(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at) VALUES (?, ?, ?, ?, ?)`,
  );
  const rotateTransaction = db.transaction(() => {
    revokeStmt.run(existing.id);
    insertStmt.run(newId, existing.user_id, newTokenHash, existing.family_id, expiresAt);
  });
  rotateTransaction();

  return { userId: existing.user_id, rawToken: newRawToken };
}

/** Revoke all refresh tokens for a user (logout-all, password change). */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}

/** Revoke a single refresh token by its raw value. */
export async function revokeSingleToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await query(`UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = $1`, [tokenHash]);
}

/** Purge expired refresh tokens older than 30 days (cleanup job). */
export async function purgeExpiredRefreshTokens(): Promise<void> {
  await query(
    `DELETE FROM refresh_tokens WHERE expires_at < datetime('now', '-30 days')`,
  );
}
