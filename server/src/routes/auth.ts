import { Router } from 'express';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { query, generateUuid } from '../db.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ValidationError, NotFoundError, UnauthorizedError, ConflictError, ForbiddenError } from '../lib/httpErrors.js';
import { validateUsername, validatePassword, validateEmail, validateDisplayName } from '../lib/validation.js';
import { isPathSafe } from '../lib/pathSafety.js';
import { avatarUpload, AVATAR_STORAGE_PATH } from '../lib/uploadConfig.js';
import { config } from '../lib/config.js';
import { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies } from '../lib/cookies.js';
import { createRefreshToken, rotateRefreshToken, revokeAllUserTokens, revokeSingleToken } from '../lib/refreshTokens.js';

const router = Router();

// GET /api/auth/status — public (no auth required)
router.get('/status', (_req, res) => {
  res.json({ registrationEnabled: config.registrationEnabled });
});

// POST /api/auth/register
router.post('/register', asyncHandler(async (req, res) => {
  if (!config.registrationEnabled) {
    throw new ForbiddenError('Registration is currently disabled');
  }

  const { username, password, displayName } = req.body;

  validateUsername(username);
  validatePassword(password);
  if (displayName !== undefined) validateDisplayName(displayName);

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const userId = generateUuid();
  let result;
  try {
    result = await query(
      'INSERT INTO users (id, username, password_hash, display_name) VALUES ($1, $2, $3, $4) RETURNING id, username, display_name, created_at',
      [userId, username.toLowerCase(), passwordHash, displayName || username]
    );
  } catch (err: unknown) {
    const sqliteErr = err as { code?: string };
    if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ConflictError('Username already taken');
    }
    throw err;
  }

  const user = result.rows[0];
  const token = signToken({ id: user.id, username: user.username });
  const refresh = await createRefreshToken(user.id);

  setAccessTokenCookie(res, token);
  setRefreshTokenCookie(res, refresh.rawToken);

  res.status(201).json({
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      email: null,
      avatarUrl: null,
      createdAt: user.created_at,
    },
  });
}));

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new ValidationError('Username and password required');
  }

  const result = await query(
    'SELECT id, username, password_hash, display_name, email, avatar_path, active_location_id FROM users WHERE username = $1',
    [username.toLowerCase()]
  );

  if (result.rows.length === 0) {
    throw new UnauthorizedError('Invalid username or password');
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new UnauthorizedError('Invalid username or password');
  }

  const token = signToken({ id: user.id, username: user.username });
  const refresh = await createRefreshToken(user.id);

  setAccessTokenCookie(res, token);
  setRefreshTokenCookie(res, refresh.rawToken);

  // Use persisted active_location_id if user is still a member
  let activeLocationId: string | null = null;
  if (user.active_location_id) {
    const memberCheck = await query(
      'SELECT 1 FROM location_members WHERE location_id = $1 AND user_id = $2',
      [user.active_location_id, user.id]
    );
    if (memberCheck.rows.length > 0) {
      activeLocationId = user.active_location_id;
    }
  }

  // Fallback: pick most recently updated location
  if (!activeLocationId) {
    const locationsResult = await query(
      `SELECT l.id FROM locations l
       JOIN location_members lm ON lm.location_id = l.id AND lm.user_id = $1
       ORDER BY l.updated_at DESC LIMIT 1`,
      [user.id]
    );
    if (locationsResult.rows.length > 0) {
      activeLocationId = locationsResult.rows[0].id;
      // Seed the column for future logins
      await query('UPDATE users SET active_location_id = $1 WHERE id = $2', [activeLocationId, user.id]);
    }
  }

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      email: user.email || null,
      avatarUrl: user.avatar_path ? `/api/auth/avatar/${user.id}` : null,
    },
    activeLocationId,
  });
}));

// POST /api/auth/refresh — rotate refresh token (no authenticate middleware — access token may be expired)
router.post('/refresh', asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.['openbin-refresh'] as string | undefined;

  if (!rawToken) {
    clearAuthCookies(res);
    throw new UnauthorizedError('No refresh token');
  }

  const rotated = await rotateRefreshToken(rawToken);
  if (!rotated) {
    clearAuthCookies(res);
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  // Look up user for new access token
  const userResult = await query<{ id: string; username: string }>(
    'SELECT id, username FROM users WHERE id = $1',
    [rotated.userId],
  );
  if (userResult.rows.length === 0) {
    clearAuthCookies(res);
    throw new UnauthorizedError('User not found');
  }

  const user = userResult.rows[0];
  const accessToken = signToken({ id: user.id, username: user.username });

  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, rotated.rawToken);

  res.json({ message: 'Token refreshed' });
}));

// POST /api/auth/logout — revoke refresh token and clear cookies (no authenticate required)
router.post('/logout', asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.['openbin-refresh'] as string | undefined;
  if (rawToken) {
    await revokeSingleToken(rawToken);
  }
  clearAuthCookies(res);
  res.json({ message: 'Logged out' });
}));

// POST /api/auth/logout-all — revoke all refresh tokens (requires authenticate)
router.post('/logout-all', authenticate, asyncHandler(async (req, res) => {
  await revokeAllUserTokens(req.user!.id);
  clearAuthCookies(res);
  res.json({ message: 'All sessions logged out' });
}));

// GET /api/auth/me
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, username, display_name, email, avatar_path, active_location_id, created_at, updated_at FROM users WHERE id = $1',
    [req.user!.id]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  const user = result.rows[0];

  // Validate stored active_location_id — clear if no longer a member
  let activeLocationId: string | null = user.active_location_id || null;
  if (activeLocationId) {
    const memberCheck = await query(
      'SELECT 1 FROM location_members WHERE location_id = $1 AND user_id = $2',
      [activeLocationId, user.id]
    );
    if (memberCheck.rows.length === 0) {
      activeLocationId = null;
      await query('UPDATE users SET active_location_id = NULL WHERE id = $1', [user.id]);
    }
  }

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    email: user.email || null,
    avatarUrl: user.avatar_path ? `/api/auth/avatar/${user.id}` : null,
    activeLocationId,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  });
}));

// PUT /api/auth/profile — update display name and/or email
router.put('/profile', authenticate, asyncHandler(async (req, res) => {
  const { displayName, email } = req.body;

  if (displayName !== undefined) {
    validateDisplayName(displayName);
  }

  if (email !== undefined && email !== null && email !== '') {
    validateEmail(email);
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (displayName !== undefined) {
    updates.push(`display_name = $${idx++}`);
    values.push(String(displayName).trim());
  }
  if (email !== undefined) {
    updates.push(`email = $${idx++}`);
    values.push(email === '' ? null : email);
  }

  if (updates.length === 0) {
    throw new ValidationError('No fields to update');
  }

  updates.push(`updated_at = datetime('now')`);
  values.push(req.user!.id);

  const result = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, username, display_name, email, avatar_path, created_at, updated_at`,
    values
  );

  const user = result.rows[0];
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    email: user.email || null,
    avatarUrl: user.avatar_path ? `/api/auth/avatar/${user.id}` : null,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  });
}));

// PUT /api/auth/active-location — persist active location selection
router.put('/active-location', authenticate, asyncHandler(async (req, res) => {
  const { locationId } = req.body;

  if (locationId !== null && locationId !== undefined) {
    if (typeof locationId !== 'string' || locationId.length === 0) {
      throw new ValidationError('locationId must be a non-empty string or null');
    }
    const memberCheck = await query(
      'SELECT 1 FROM location_members WHERE location_id = $1 AND user_id = $2',
      [locationId, req.user!.id]
    );
    if (memberCheck.rows.length === 0) {
      throw new ForbiddenError('Not a member of this location');
    }
  }

  await query('UPDATE users SET active_location_id = $1 WHERE id = $2', [locationId ?? null, req.user!.id]);

  res.json({ activeLocationId: locationId ?? null });
}));

// PUT /api/auth/password — change password
router.put('/password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ValidationError('Current password and new password are required');
  }
  validatePassword(newPassword);

  const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
  if (!valid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const newHash = await bcrypt.hash(newPassword, config.bcryptRounds);
  await query(`UPDATE users SET password_hash = $1, updated_at = datetime('now') WHERE id = $2`, [newHash, req.user!.id]);

  // Revoke all refresh tokens to force re-login on all devices
  await revokeAllUserTokens(req.user!.id);
  clearAuthCookies(res);

  res.json({ message: 'Password updated successfully' });
}));

// POST /api/auth/avatar — upload avatar
router.post('/avatar', authenticate, avatarUpload.single('avatar'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ValidationError('No file uploaded');
  }

  // Delete old avatar file if exists
  const existing = await query('SELECT avatar_path FROM users WHERE id = $1', [req.user!.id]);
  if (existing.rows[0]?.avatar_path) {
    const oldPath = existing.rows[0].avatar_path;
    try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
  }

  const storagePath = req.file.path;
  await query(`UPDATE users SET avatar_path = $1, updated_at = datetime('now') WHERE id = $2`, [storagePath, req.user!.id]);

  res.json({ avatarUrl: `/api/auth/avatar/${req.user!.id}` });
}));

// DELETE /api/auth/avatar — remove avatar
router.delete('/avatar', authenticate, asyncHandler(async (req, res) => {
  const result = await query('SELECT avatar_path FROM users WHERE id = $1', [req.user!.id]);
  const avatarPath = result.rows[0]?.avatar_path;

  if (avatarPath) {
    try { fs.unlinkSync(avatarPath); } catch { /* ignore */ }
  }

  await query(`UPDATE users SET avatar_path = NULL, updated_at = datetime('now') WHERE id = $1`, [req.user!.id]);

  res.json({ message: 'Avatar removed' });
}));

// GET /api/auth/avatar/:userId — serve avatar file
router.get('/avatar/:userId', authenticate, asyncHandler(async (req, res) => {
  const result = await query('SELECT avatar_path FROM users WHERE id = $1', [req.params.userId]);
  const avatarPath = result.rows[0]?.avatar_path;

  if (!avatarPath) {
    throw new NotFoundError('No avatar found');
  }

  if (!isPathSafe(avatarPath, AVATAR_STORAGE_PATH)) {
    throw new ValidationError('Invalid avatar path');
  }

  if (!fs.existsSync(avatarPath)) {
    throw new NotFoundError('Avatar file not found');
  }

  const ext = path.extname(avatarPath).toLowerCase();
  const mimeMap: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  fs.createReadStream(avatarPath).pipe(res);
}));

// DELETE /api/auth/account — permanently delete account
router.delete('/account', authenticate, asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) {
    throw new ValidationError('Password is required');
  }

  const userId = req.user!.id;

  // Verify password
  const userResult = await query('SELECT password_hash, avatar_path FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  const valid = await bcrypt.compare(password, userResult.rows[0].password_hash);
  if (!valid) {
    throw new UnauthorizedError('Incorrect password');
  }

  const avatarPath = userResult.rows[0].avatar_path;

  // Find locations where user is a member
  const locationsResult = await query(
    `SELECT l.id FROM locations l JOIN location_members lm ON l.id = lm.location_id WHERE lm.user_id = $1`,
    [userId]
  );

  const PHOTO_STORAGE = config.photoStoragePath;

  for (const location of locationsResult.rows) {
    const countResult = await query('SELECT COUNT(*) AS count FROM location_members WHERE location_id = $1', [location.id]);
    const memberCount = parseInt(countResult.rows[0].count as string, 10);

    if (memberCount === 1) {
      // Sole member — delete photo files for all bins in this location
      const photosResult = await query(
        `SELECT p.storage_path FROM photos p JOIN bins b ON p.bin_id = b.id WHERE b.location_id = $1`,
        [location.id]
      );
      for (const photo of photosResult.rows) {
        try { fs.unlinkSync(path.join(PHOTO_STORAGE, photo.storage_path)); } catch { /* ignore */ }
      }
      // Delete bin directories
      const binsResult = await query('SELECT id FROM bins WHERE location_id = $1', [location.id]);
      for (const bin of binsResult.rows) {
        const binDir = path.join(PHOTO_STORAGE, bin.id);
        try { fs.rmSync(binDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
      // Cascade deletes bins, photos, tag_colors, location_members
      await query('DELETE FROM locations WHERE id = $1', [location.id]);
    }
    // If count > 1, location_members row is removed by ON DELETE CASCADE on users
  }

  // Delete avatar file
  if (avatarPath) {
    try { fs.unlinkSync(avatarPath); } catch { /* ignore */ }
  }

  // Delete user — cascades location_members, refresh_tokens, sets NULL on bins/photos/locations created_by
  await query('DELETE FROM users WHERE id = $1', [userId]);
  clearAuthCookies(res);

  res.json({ message: 'Account deleted' });
}));

export default router;
