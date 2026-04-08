import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { d, generateUuid, query } from '../db.js';
import { invalidateUserStatusCache } from '../middleware/auth.js';
import { config } from './config.js';
import { UnauthorizedError } from './httpErrors.js';
import { hashToken, revokeAllUserTokens } from './refreshTokens.js';
import { validatePassword } from './validation.js';

export const TOKEN_EXPIRY_HOURS = 2;

export interface ResetTokenResult {
  rawToken: string;
  expiresAt: string;
}

/** Create a password reset token for a user. Returns the raw token (show once). */
export async function createPasswordResetToken(
  userId: string,
  createdBy: string | null,
): Promise<ResetTokenResult> {
  // Invalidate any existing unused tokens for this user
  await query(
    `UPDATE password_reset_tokens SET used_at = ${d.now()}
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId],
  );

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const id = generateUuid();
  const expiresAt = new Date(
    Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
  ).toISOString();

  await query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, created_by, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, tokenHash, createdBy, expiresAt],
  );

  return { rawToken, expiresAt };
}

/** Consume a reset token and set the new password. Throws on invalid/expired token. */
export async function consumeResetToken(
  rawToken: string,
  newPassword: string,
): Promise<{ userId: string }> {
  validatePassword(newPassword);

  const tokenHash = hashToken(rawToken);

  // Atomically claim the token (prevents TOCTOU race with concurrent requests)
  const result = await query<{
    id: string;
    user_id: string;
  }>(
    `UPDATE password_reset_tokens SET used_at = ${d.now()}
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > ${d.now()}
     RETURNING id, user_id`,
    [tokenHash],
  );

  if (result.rows.length === 0) {
    throw new UnauthorizedError('Invalid or expired reset token');
  }

  const token = result.rows[0];

  // Hash new password and update user, bump token_version to invalidate existing JWTs
  const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
  await query(
    `UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = ${d.now()} WHERE id = $2`,
    [passwordHash, token.user_id],
  );

  // Revoke all refresh tokens (force re-login on all devices)
  await revokeAllUserTokens(token.user_id);
  invalidateUserStatusCache(token.user_id);

  return { userId: token.user_id };
}
