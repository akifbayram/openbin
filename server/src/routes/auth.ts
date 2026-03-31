import fs from 'node:fs';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import { d, generateUuid, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { config } from '../lib/config.js';
import { clearAuthCookies, setAccessTokenCookie, setRefreshTokenCookie } from '../lib/cookies.js';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../lib/httpErrors.js';
import { createLogger } from '../lib/logger.js';
import { deleteUserData, notifyManagerNewUser, notifyManagerUserUpdate } from '../lib/managerWebhook.js';
import { consumeResetToken, createPasswordResetToken } from '../lib/passwordReset.js';
import { safePath } from '../lib/pathSafety.js';
import { isSelfHosted, Plan, planLabel, SubStatus, subStatusLabel } from '../lib/planGate.js';
import { createRefreshToken, revokeAllUserTokens, revokeSingleToken, rotateRefreshToken } from '../lib/refreshTokens.js';
import { validateDisplayName, validateEmail, validatePassword, validateUsername } from '../lib/validation.js';
import { authenticate, signToken } from '../middleware/auth.js';

import { getRegistrationMode } from './admin.js';

const log = createLogger('auth');
const router = Router();

// GET /api/auth/status — public (no auth required)
router.get('/status', async (_req, res) => {
  const regMode = await getRegistrationMode();
  const body: Record<string, unknown> = {
    registrationEnabled: regMode !== 'closed',
    registrationMode: regMode,
    demoMode: config.demoMode,
    qrPayloadMode: config.qrPayloadMode,
    selfHosted: config.selfHosted,
  };
  if (config.qrPayloadMode === 'url' && config.baseUrl) {
    body.baseUrl = config.baseUrl;
  }
  res.json(body);
});

// POST /api/auth/demo-login — log in as demo user (only when DEMO_MODE is enabled)
router.post('/demo-login', asyncHandler(async (_req, res) => {
  if (!config.demoMode) {
    throw new ForbiddenError('Demo mode is not enabled');
  }

  const result = await query(
    'SELECT id, username, display_name, email, avatar_path, active_location_id FROM users WHERE username = $1',
    ['demo'],
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Demo user not found');
  }

  const user = result.rows[0];

  // Reset onboarding so every new demo session starts fresh
  const existingPrefs = await query('SELECT settings FROM user_preferences WHERE user_id = $1', [user.id]);
  const currentSettings = existingPrefs.rows.length > 0 ? (existingPrefs.rows[0].settings as Record<string, unknown>) : {};
  const resetSettings = JSON.stringify({ ...currentSettings, onboarding_completed: false, onboarding_step: 0, onboarding_location_id: null });
  if (existingPrefs.rows.length > 0) {
    await query('UPDATE user_preferences SET settings = $1 WHERE user_id = $2', [resetSettings, user.id]);
  } else {
    await query('INSERT INTO user_preferences (id, user_id, settings) VALUES ($1, $2, $3)', [generateUuid(), user.id, resetSettings]);
  }

  const token = await signToken({ id: user.id, username: user.username });
  const refresh = await createRefreshToken(user.id);

  setAccessTokenCookie(res, token);
  setRefreshTokenCookie(res, refresh.rawToken);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      email: user.email || null,
      avatarUrl: user.avatar_path ? `/api/auth/avatar/${user.id}` : null,
    },
    activeLocationId: user.active_location_id || null,
  });
}));

// GET /api/auth/invite-preview?code=CODE — public (no auth required)
router.get('/invite-preview', asyncHandler(async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    throw new ValidationError('Invite code is required');
  }

  const result = await query(
    `SELECT l.name,
            (SELECT COUNT(*) FROM location_members WHERE location_id = l.id) AS member_count
     FROM locations l
     WHERE l.invite_code = $1`,
    [code.trim()]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Invalid invite code');
  }

  const row = result.rows[0];
  res.json({
    name: row.name,
    memberCount: Number(row.member_count),
  });
}));

// POST /api/auth/register
router.post('/register', asyncHandler(async (req, res) => {
  const regMode = await getRegistrationMode();
  if (regMode === 'closed') {
    throw new ForbiddenError('Registration is currently disabled');
  }

  const { username, password, displayName, email, inviteCode } = req.body;

  // In invite mode, invite code is required
  if (regMode === 'invite' && !inviteCode) {
    throw new ValidationError('An invite code is required to register');
  }

  // Validate invite code if provided (in any mode)
  let locationToJoin: { id: string; default_join_role: string } | null = null;
  if (inviteCode && typeof inviteCode === 'string') {
    const locResult = await query(
      'SELECT id, default_join_role FROM locations WHERE invite_code = $1',
      [inviteCode.trim()]
    );
    if (locResult.rows.length === 0) {
      throw new NotFoundError('Invalid invite code');
    }
    locationToJoin = locResult.rows[0] as { id: string; default_join_role: string };
  }

  validateUsername(username);
  validatePassword(password);
  if (displayName !== undefined) validateDisplayName(displayName);
  const trimmedEmail = (typeof email === 'string' && email.trim()) || null;
  if (trimmedEmail) validateEmail(trimmedEmail);

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const userId = generateUuid();
  let result: import('../db.js').QueryResult<Record<string, unknown>>;
  try {
    result = await query(
      `INSERT INTO users (id, username, password_hash, display_name, email, plan, sub_status, active_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, username, display_name, email, created_at, active_until`,
      [
        userId,
        username.toLowerCase(),
        passwordHash,
        displayName || username,
        trimmedEmail,
        Plan.PRO,
        isSelfHosted() ? SubStatus.ACTIVE : SubStatus.TRIAL,
        isSelfHosted()
          ? new Date(Date.now() + 1000 * 365 * 24 * 60 * 60 * 1000).toISOString()  // +1000 years
          : new Date(Date.now() + config.trialPeriodDays * 24 * 60 * 60 * 1000).toISOString(),
      ]
    );
  } catch (err: unknown) {
    const sqliteErr = err as { code?: string; message?: string };
    if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      if (sqliteErr.message?.includes('idx_users_email_unique')) {
        throw new ConflictError('An account with this email already exists');
      }
      throw new ConflictError('Username already taken');
    }
    throw err;
  }

  const user = result.rows[0] as { id: string; username: string; display_name: string; email: string | null; created_at: string; active_until: string };

  // Auto-join location if invite code was valid
  if (locationToJoin) {
    await query(
      'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [generateUuid(), locationToJoin.id, user.id, locationToJoin.default_join_role]
    );
    await query('UPDATE users SET active_location_id = $1 WHERE id = $2', [locationToJoin.id, user.id]);
  }

  const token = await signToken({ id: user.id, username: user.username });
  const refresh = await createRefreshToken(user.id);

  setAccessTokenCookie(res, token);
  setRefreshTokenCookie(res, refresh.rawToken);

  log.info(`New user registered: ${user.username}`);

  res.status(201).json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      email: user.email || null,
      avatarUrl: null,
      createdAt: user.created_at,
    },
  });

  // Notify Manager service of new cloud registration (fire-and-forget)
  notifyManagerNewUser({
    userId: user.id,
    email: user.email,
    username: user.username,
    activeUntil: user.active_until,
    status: 'trial',
  });

  // Fire welcome email if email was provided (cloud mode only)
  if (user.email && !isSelfHosted()) {
    const { fireWelcomeEmail } = await import('../lib/emailSender.js');
    fireWelcomeEmail(user.id, user.email, user.display_name);
  }
}));

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new ValidationError('Username and password required');
  }

  const result = await query(
    'SELECT id, username, password_hash, display_name, email, avatar_path, active_location_id, deleted_at, is_admin FROM users WHERE username = $1',
    [username.toLowerCase()]
  );

  if (result.rows.length === 0) {
    // Constant-time rejection — prevent timing-based username enumeration
    await bcrypt.compare(password, '$2b$12$000000000000000000000uVjKPCGJcotDu8bMahKn7VoPxpL0Wi');
    log.warn(`Login failed: unknown user "${username}"`);
    throw new UnauthorizedError('Invalid username or password');
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    log.warn(`Login failed: bad password for user "${username}"`);
    throw new UnauthorizedError('Invalid username or password');
  }
  if (user.deleted_at) {
    log.warn(`Login failed: deleted user "${username}"`);
    throw new UnauthorizedError('Invalid username or password');
  }

  const token = await signToken({ id: user.id, username: user.username });
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

  log.info(`User "${user.username}" logged in`);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      email: user.email || null,
      avatarUrl: user.avatar_path ? `/api/auth/avatar/${user.id}` : null,
      isAdmin: user.is_admin === 1,
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

  // Look up user for new access token (reject soft-deleted users)
  const userResult = await query<{ id: string; username: string; deleted_at: string | null }>(
    'SELECT id, username, deleted_at FROM users WHERE id = $1',
    [rotated.userId],
  );
  if (userResult.rows.length === 0 || userResult.rows[0].deleted_at !== null) {
    clearAuthCookies(res);
    throw new UnauthorizedError('User not found');
  }

  const user = userResult.rows[0];
  const accessToken = await signToken({ id: user.id, username: user.username });

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
    'SELECT id, username, display_name, email, avatar_path, active_location_id, created_at, updated_at, plan, sub_status, active_until, is_admin FROM users WHERE id = $1',
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
    demoMode: config.demoMode,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    plan: planLabel(user.plan),
    subscriptionStatus: subStatusLabel(user.sub_status),
    activeUntil: user.active_until || null,
    isAdmin: user.is_admin === 1,
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

  // Check if user currently has no email (for welcome email trigger)
  const existingUser = email ? (await query('SELECT email FROM users WHERE id = $1', [req.user!.id])).rows[0] : null;
  const isFirstEmail = existingUser && !existingUser.email && email && email !== '';

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

  updates.push(`updated_at = ${d.now()}`);
  values.push(req.user!.id);

  let result: import('../db.js').QueryResult<Record<string, unknown>>;
  try {
    result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, username, display_name, email, avatar_path, created_at, updated_at`,
      values
    );
  } catch (err: unknown) {
    const sqliteErr = err as { code?: string; message?: string };
    if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE' && sqliteErr.message?.includes('idx_users_email_unique')) {
      throw new ConflictError('An account with this email already exists');
    }
    throw err;
  }

  const user = result.rows[0] as { id: string; username: string; display_name: string; email: string | null; avatar_path: string | null; created_at: string; updated_at: string };
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    email: user.email || null,
    avatarUrl: user.avatar_path ? `/api/auth/avatar/${user.id}` : null,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  });

  // Fire welcome email when user sets email for the first time (cloud mode)
  if (isFirstEmail && user.email && !isSelfHosted()) {
    const { fireWelcomeEmail } = await import('../lib/emailSender.js');
    fireWelcomeEmail(user.id, user.email, user.display_name);
  }
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
  await query(`UPDATE users SET password_hash = $1, updated_at = ${d.now()} WHERE id = $2`, [newHash, req.user!.id]);

  // Revoke all refresh tokens to force re-login on all devices
  await revokeAllUserTokens(req.user!.id);
  clearAuthCookies(res);

  log.info(`User ${req.user!.username} changed password`);
  res.json({ message: 'Password updated successfully' });
}));

// DELETE /api/auth/account — permanently delete account
router.delete('/account', authenticate, asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) {
    throw new ValidationError('Password is required');
  }

  const userId = req.user!.id;

  // Verify password
  const userResult = await query('SELECT password_hash, avatar_path, is_admin FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  const valid = await bcrypt.compare(password, userResult.rows[0].password_hash);
  if (!valid) {
    throw new UnauthorizedError('Incorrect password');
  }

  const avatarPath = userResult.rows[0].avatar_path;

  if (userResult.rows[0].is_admin === 1) {
    const adminCountResult = await query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM users WHERE is_admin = 1', []);
    if (adminCountResult.rows[0].cnt <= 1) {
      throw new ForbiddenError('Cannot delete the only admin account');
    }
  }

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
        const photoPath = safePath(PHOTO_STORAGE, photo.storage_path);
        if (photoPath) {
          try { fs.unlinkSync(photoPath); } catch { /* ignore */ }
        }
      }
      // Delete bin directories
      const binsResult = await query('SELECT id FROM bins WHERE location_id = $1', [location.id]);
      for (const bin of binsResult.rows) {
        const binDir = safePath(PHOTO_STORAGE, bin.id);
        if (binDir) {
          try { fs.rmSync(binDir, { recursive: true, force: true }); } catch { /* ignore */ }
        }
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

  await deleteUserData(userId);

  await query('DELETE FROM users WHERE id = $1', [userId]);

  notifyManagerUserUpdate({ userId, action: 'delete_user' });

  clearAuthCookies(res);

  log.info(`User ${req.user!.username} deleted their account`);

  res.json({ message: 'Account deleted' });
}));

// POST /api/auth/forgot-password — request a password reset email (no auth)
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required');
  }
  validateEmail(email.trim());

  const result = await query<{ id: string; display_name: string; email: string }>(
    'SELECT id, display_name, email FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL',
    [email.trim()],
  );

  if (result.rows.length > 0) {
    if (config.baseUrl) {
      const user = result.rows[0];
      const { rawToken } = await createPasswordResetToken(user.id, null);
      const resetUrl = `${config.baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
      const { firePasswordResetEmail } = await import('../lib/emailSender.js');
      firePasswordResetEmail(user.id, user.email, user.display_name, resetUrl);
    } else {
      log.warn('forgot-password: BASE_URL is not set, reset email not sent');
    }
  }

  res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
}));

// POST /api/auth/reset-password — consume reset token and set new password (no auth)
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || typeof token !== 'string') {
    throw new ValidationError('Reset token is required');
  }
  if (!newPassword) {
    throw new ValidationError('New password is required');
  }

  await consumeResetToken(token, newPassword);

  log.info('Password reset completed via token');
  res.json({ message: 'Password has been reset successfully' });
}));

export default router;
