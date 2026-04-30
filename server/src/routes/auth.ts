import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import * as jose from 'jose';
import { d, generateUuid, isUniqueViolation, query } from '../db.js';
import { recoverDeletion, requestDeletion } from '../lib/accountDeletion.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { config } from '../lib/config.js';
import { clearAuthCookies, setAccessTokenCookie, setRefreshTokenCookie } from '../lib/cookies.js';
import { getEeHooks } from '../lib/eeHooks.js';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../lib/httpErrors.js';
import { createLogger } from '../lib/logger.js';
import {
  appleJwks,
  clearOAuthCookies,
  finalizeOAuthLogin,
  findOrCreateOAuthUser,
  generateNonce,
  generatePkce,
  generateState,
  getCodeVerifier,
  getOAuthProviders,
  googleJwks,
  validateState,
} from '../lib/oauth.js';
import { consumeResetToken, createPasswordResetToken } from '../lib/passwordReset.js';
import { isSelfHosted, Plan, planLabel, SubStatus, subStatusLabel } from '../lib/planGate.js';
import { queryMaybeOne, queryOne } from '../lib/queryHelpers.js';
import { createRefreshToken, revokeAllUserTokens, revokeSingleToken, rotateRefreshToken } from '../lib/refreshTokens.js';
import { validateDisplayName, validateEmail, validateLoginEmail, validatePassword } from '../lib/validation.js';
import { authenticate, invalidateUserStatusCache, signToken } from '../middleware/auth.js';
import { getMaintenanceMessage, isMaintenanceMode } from '../middleware/maintenance.js';

import { getRegistrationMode } from './admin.js';

const log = createLogger('auth');
const router = Router();

async function isLocationMember(locationId: string, userId: string): Promise<boolean> {
  const row = await queryMaybeOne(
    'SELECT 1 FROM location_members WHERE location_id = $1 AND user_id = $2',
    [locationId, userId],
  );
  return row !== null;
}

// GET /api/auth/status — public (no auth required)
router.get('/status', async (_req, res) => {
  const regMode = await getRegistrationMode();
  const body: Record<string, unknown> = {
    registrationEnabled: regMode !== 'closed',
    registrationMode: regMode,
    demoMode: config.demoMode,
    qrPayloadMode: config.qrPayloadMode,
    selfHosted: config.selfHosted,
    attachmentsEnabled: config.attachmentsEnabled,
    oauthProviders: getOAuthProviders(),
  };
  if (config.qrPayloadMode === 'url' && config.baseUrl) {
    body.baseUrl = config.baseUrl;
  }

  // Include active announcement banner if any
  const announcement = await queryMaybeOne<{ id: string; text: string; type: string; dismissible: number | boolean }>(
    "SELECT id, text, type, dismissible FROM announcements WHERE active = TRUE ORDER BY created_at DESC LIMIT 1",
    [],
  );
  if (announcement) {
    body.announcement = { id: announcement.id, text: announcement.text, type: announcement.type, dismissible: !!announcement.dismissible };
  }

  // Include maintenance mode status
  if (isMaintenanceMode()) {
    body.maintenance = { enabled: true, message: getMaintenanceMessage() };
  }

  res.json(body);
});

// POST /api/auth/demo-login — log in as demo user (only when DEMO_MODE is enabled)
router.post('/demo-login', asyncHandler(async (_req, res) => {
  if (!config.demoMode) {
    throw new ForbiddenError('Demo mode is not enabled');
  }

  const user = await queryOne<{ id: string; display_name: string; email: string; avatar_path: string | null; active_location_id: string | null }>(
    'SELECT id, display_name, email, avatar_path, active_location_id FROM users WHERE email = $1',
    ['demo@openbin.local'],
    'Demo user not found',
  );

  // Reset onboarding so every new demo session starts fresh
  const existingPrefs = await queryMaybeOne<{ settings: Record<string, unknown> }>(
    'SELECT settings FROM user_preferences WHERE user_id = $1',
    [user.id],
  );
  const currentSettings = existingPrefs?.settings ?? {};
  const resetSettings = JSON.stringify({ ...currentSettings, onboarding_completed: false, onboarding_step: 0, onboarding_location_id: null });
  if (existingPrefs) {
    await query('UPDATE user_preferences SET settings = $1 WHERE user_id = $2', [resetSettings, user.id]);
  } else {
    await query('INSERT INTO user_preferences (id, user_id, settings) VALUES ($1, $2, $3)', [generateUuid(), user.id, resetSettings]);
  }

  const token = await signToken({ id: user.id, email: user.email });
  const refresh = await createRefreshToken(user.id);

  setAccessTokenCookie(res, token);
  setRefreshTokenCookie(res, refresh.rawToken);

  res.json({
    user: {
      id: user.id,
      displayName: user.display_name,
      email: user.email,
      avatarUrl: user.avatar_path ? `/api/auth/avatar/${user.id}` : null,
    },
    activeLocationId: user.active_location_id || null,
  });
}));

// GET /api/auth/invite-preview?code=CODE — requires authentication to prevent info leakage
router.get('/invite-preview', authenticate, asyncHandler(async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    throw new ValidationError('Invite code is required');
  }

  const row = await queryOne<{ name: string; member_count: number | string }>(
    `SELECT l.name,
            (SELECT COUNT(*) FROM location_members WHERE location_id = l.id) AS member_count
     FROM locations l
     WHERE l.invite_code = $1`,
    [code.trim()],
    'Invalid invite code',
  );

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

  const { email, password, displayName, inviteCode } = req.body;

  // In invite mode, invite code is required
  if (regMode === 'invite' && !inviteCode) {
    throw new ValidationError('An invite code is required to register');
  }

  // Validate invite code if provided (in any mode)
  let locationToJoin: { id: string; default_join_role: string } | null = null;
  if (inviteCode && typeof inviteCode === 'string') {
    locationToJoin = await queryOne<{ id: string; default_join_role: string }>(
      'SELECT id, default_join_role FROM locations WHERE invite_code = $1',
      [inviteCode.trim()],
      'Invalid invite code',
    );
  }

  const trimmedEmail = validateLoginEmail(email);
  validatePassword(password);
  validateDisplayName(displayName);

  // Block re-registration when an account with this email is soft-deleted
  // during the grace window. Lets the user recover instead of orphaning the
  // billing customer record. UNIQUE(email) would also fail this, but the
  // dedicated error gives a recoverable code the client can act on.
  const pending = await queryMaybeOne<{ deletion_scheduled_at: string | null }>(
    'SELECT deletion_scheduled_at FROM users WHERE email = $1 AND deletion_scheduled_at IS NOT NULL',
    [trimmedEmail],
  );
  if (pending?.deletion_scheduled_at && new Date(pending.deletion_scheduled_at).getTime() > Date.now()) {
    throw new ConflictError({
      code: 'EMAIL_PENDING_DELETION',
      message: 'An account with this email is scheduled for deletion. Recover it or wait until the deletion completes.',
      scheduledAt: pending.deletion_scheduled_at,
    });
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const userId = generateUuid();
  let result: import('../db.js').QueryResult<Record<string, unknown>>;
  try {
    result = await query(
      `INSERT INTO users (id, password_hash, display_name, email, plan, sub_status, active_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, display_name, email, created_at, active_until`,
      [
        userId,
        passwordHash,
        displayName.trim(),
        trimmedEmail,
        Plan.PLUS,
        isSelfHosted() ? SubStatus.ACTIVE : SubStatus.TRIAL,
        isSelfHosted()
          ? new Date(Date.now() + 1000 * 365 * 24 * 60 * 60 * 1000).toISOString()  // +1000 years
          : new Date(Date.now() + config.trialPeriodDays * 24 * 60 * 60 * 1000).toISOString(),
      ]
    );
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new ConflictError('Registration failed — please try different credentials');
    }
    throw err;
  }

  const user = result.rows[0] as { id: string; display_name: string; email: string; created_at: string; active_until: string };

  // Auto-join location if invite code was valid
  if (locationToJoin) {
    await query(
      'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [generateUuid(), locationToJoin.id, user.id, locationToJoin.default_join_role]
    );
    await query('UPDATE users SET active_location_id = $1 WHERE id = $2', [locationToJoin.id, user.id]);
  }

  const token = await signToken({ id: user.id, email: user.email });
  const refresh = await createRefreshToken(user.id);

  setAccessTokenCookie(res, token);
  setRefreshTokenCookie(res, refresh.rawToken);

  log.info(`New user registered: ${user.email}`);

  res.status(201).json({
    user: {
      id: user.id,
      displayName: user.display_name,
      email: user.email,
      avatarUrl: null,
      createdAt: user.created_at,
    },
  });

  // Notify Manager service of new cloud registration (fire-and-forget)
  getEeHooks().onNewUser?.({
    userId: user.id,
    email: user.email,
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
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ValidationError('Email and password required');
  }

  const result = await query(
    'SELECT id, password_hash, display_name, email, avatar_path, active_location_id, deleted_at, deletion_scheduled_at, suspended_at, token_version, force_password_change, is_admin FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );

  const ip = req.ip || req.socket.remoteAddress || null;
  const ua = req.headers['user-agent'] || null;

  if (result.rows.length === 0) {
    // Constant-time rejection — prevent timing-based email enumeration
    await bcrypt.compare(password, '$2b$12$000000000000000000000uVjKPCGJcotDu8bMahKn7VoPxpL0Wi');
    log.warn(`Login failed: unknown email "${email}"`);
    throw new UnauthorizedError('Invalid email or password');
  }

  const user = result.rows[0];

  // Social-only users have no password — return generic credentials error to
  // avoid leaking that the account exists. Run a dummy bcrypt to equalize timing.
  if (!user.password_hash) {
    await bcrypt.compare(password, '$2b$12$000000000000000000000uVjKPCGJcotDu8bMahKn7VoPxpL0Wi');
    log.warn(`Login failed: no password set for "${email}" (social-only account)`);
    query('INSERT INTO login_history (id, user_id, ip_address, user_agent, method, success) VALUES ($1, $2, $3, $4, $5, 0)',
      [generateUuid(), user.id, ip, ua, 'password']).catch(() => {});
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    log.warn(`Login failed: bad password for email "${email}"`);
    // Record failed login
    query('INSERT INTO login_history (id, user_id, ip_address, user_agent, method, success) VALUES ($1, $2, $3, $4, $5, 0)', [generateUuid(), user.id, ip, ua, 'password']).catch(() => {});
    throw new UnauthorizedError('Invalid email or password');
  }
  if (user.deleted_at) {
    // Distinguish "soft-deleted, can be recovered" from "hard-deleted (gone)".
    // We've already verified the password above, so it's safe to leak existence
    // — the caller is the legitimate owner.
    if (user.deletion_scheduled_at && new Date(user.deletion_scheduled_at).getTime() > Date.now()) {
      log.info(`Login attempted on pending-deletion account "${email}"; offering recovery`);
      throw new ConflictError({
        code: 'ACCOUNT_DELETION_PENDING',
        message: 'This account is scheduled for deletion. Recover it via the recovery flow.',
        scheduledAt: user.deletion_scheduled_at,
      });
    }
    log.warn(`Login failed: deleted user "${email}"`);
    throw new UnauthorizedError('Invalid email or password');
  }
  if (user.suspended_at) {
    // Generic credentials error — gating on suspended status would let an
    // attacker enumerate which emails belong to suspended cloud accounts.
    log.warn(`Login failed: suspended user "${email}"`);
    query('INSERT INTO login_history (id, user_id, ip_address, user_agent, method, success) VALUES ($1, $2, $3, $4, $5, 0)', [generateUuid(), user.id, ip, ua, 'password']).catch(() => {});
    throw new UnauthorizedError('Invalid email or password');
  }
  if (user.force_password_change) {
    log.info(`Login blocked: force password change required for "${email}"`);
    query('INSERT INTO login_history (id, user_id, ip_address, user_agent, method, success) VALUES ($1, $2, $3, $4, $5, 0)', [generateUuid(), user.id, ip, ua, 'password']).catch(() => {});
    res.status(403).json({ error: 'FORCE_PASSWORD_CHANGE', message: 'You must change your password before logging in. Please use the password reset flow.' });
    return;
  }

  // Record successful login
  query('INSERT INTO login_history (id, user_id, ip_address, user_agent, method, success) VALUES ($1, $2, $3, $4, $5, 1)', [generateUuid(), user.id, ip, ua, 'password']).catch(() => {});

  const token = await signToken({ id: user.id, email: user.email }, user.token_version ?? 0);
  const refresh = await createRefreshToken(user.id);

  setAccessTokenCookie(res, token);
  setRefreshTokenCookie(res, refresh.rawToken);

  // Use persisted active_location_id if user is still a member
  let activeLocationId: string | null = null;
  if (user.active_location_id && await isLocationMember(user.active_location_id, user.id)) {
    activeLocationId = user.active_location_id;
  }

  // Fallback: pick most recently updated location
  if (!activeLocationId) {
    const fallback = await queryMaybeOne<{ id: string }>(
      `SELECT l.id FROM locations l
       JOIN location_members lm ON lm.location_id = l.id AND lm.user_id = $1
       ORDER BY l.updated_at DESC LIMIT 1`,
      [user.id],
    );
    if (fallback) {
      activeLocationId = fallback.id;
      // Seed the column for future logins
      await query('UPDATE users SET active_location_id = $1 WHERE id = $2', [activeLocationId, user.id]);
    }
  }

  log.info(`User "${user.email}" logged in`);

  res.json({
    user: {
      id: user.id,
      displayName: user.display_name,
      email: user.email,
      avatarUrl: user.avatar_path ? `/api/auth/avatar/${user.id}` : null,
      isAdmin: !!user.is_admin,
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

  // Look up user for new access token (reject soft-deleted/suspended users)
  const user = await queryMaybeOne<{ id: string; email: string; deleted_at: string | null; suspended_at: string | null; token_version: number }>(
    'SELECT id, email, deleted_at, suspended_at, token_version FROM users WHERE id = $1',
    [rotated.userId],
  );
  if (!user || user.deleted_at !== null) {
    clearAuthCookies(res);
    throw new UnauthorizedError('User not found');
  }
  if (user.suspended_at !== null) {
    clearAuthCookies(res);
    throw new ForbiddenError('This account has been suspended');
  }

  const accessToken = await signToken({ id: user.id, email: user.email }, user.token_version ?? 0);

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
  const user = await queryOne<Record<string, any>>(
    'SELECT id, display_name, email, avatar_path, active_location_id, created_at, updated_at, plan, sub_status, active_until, is_admin, password_hash FROM users WHERE id = $1',
    [req.user!.id],
    'User not found',
  );

  // Validate stored active_location_id — clear if no longer a member
  let activeLocationId: string | null = user.active_location_id || null;
  if (activeLocationId && !(await isLocationMember(activeLocationId, user.id))) {
    activeLocationId = null;
    await query('UPDATE users SET active_location_id = NULL WHERE id = $1', [user.id]);
  }

  res.json({
    id: user.id,
    displayName: user.display_name,
    email: user.email,
    avatarUrl: user.avatar_path ? `/api/auth/avatar/${user.id}` : null,
    activeLocationId,
    demoMode: config.demoMode,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    plan: planLabel(user.plan),
    subscriptionStatus: subStatusLabel(user.sub_status),
    activeUntil: user.active_until || null,
    isAdmin: !!user.is_admin,
    hasPassword: !!user.password_hash,
  });
}));

// PUT /api/auth/profile — update display name and/or email
router.put('/profile', authenticate, asyncHandler(async (req, res) => {
  const { displayName, email } = req.body;

  if (displayName !== undefined) {
    validateDisplayName(displayName);
  }

  let normalizedEmail: string | undefined;
  if (email !== undefined && email !== null && email !== '') {
    normalizedEmail = validateLoginEmail(email);
  }

  // Check if user currently has no email (for welcome email trigger)
  const existingUser = email
    ? await queryMaybeOne<{ email: string | null }>('SELECT email FROM users WHERE id = $1', [req.user!.id])
    : null;
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
    values.push(email === '' ? null : normalizedEmail ?? null);
  }

  if (updates.length === 0) {
    throw new ValidationError('No fields to update');
  }

  updates.push(`updated_at = ${d.now()}`);
  values.push(req.user!.id);

  let result: import('../db.js').QueryResult<Record<string, unknown>>;
  try {
    result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, display_name, email, avatar_path, created_at, updated_at`,
      values
    );
  } catch (err: unknown) {
    if (isUniqueViolation(err, 'idx_users_email_unique')) {
      throw new ConflictError('An account with this email already exists');
    }
    throw err;
  }

  const user = result.rows[0] as { id: string; display_name: string; email: string | null; avatar_path: string | null; created_at: string; updated_at: string };
  res.json({
    id: user.id,
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
    if (!(await isLocationMember(locationId, req.user!.id))) {
      throw new ForbiddenError('Not a member of this location');
    }
  }

  await query('UPDATE users SET active_location_id = $1 WHERE id = $2', [locationId ?? null, req.user!.id]);

  res.json({ activeLocationId: locationId ?? null });
}));

// PUT /api/auth/password — change password
router.put('/password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword) {
    throw new ValidationError('New password is required');
  }
  validatePassword(newPassword);

  const user = await queryOne<{ password_hash: string | null }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [req.user!.id],
    'User not found',
  );

  // Social-only users setting their first password
  if (!user.password_hash) {
    const hash = await bcrypt.hash(newPassword, config.bcryptRounds);
    await query('UPDATE users SET password_hash = $1, updated_at = $2, token_version = token_version + 1 WHERE id = $3',
      [hash, new Date().toISOString(), req.user!.id]);
    await revokeAllUserTokens(req.user!.id);
    invalidateUserStatusCache(req.user!.id);
    res.json({ message: 'Password set successfully' });
    return;
  }

  if (!currentPassword) {
    throw new ValidationError('Current password is required');
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const newHash = await bcrypt.hash(newPassword, config.bcryptRounds);
  await query(`UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = ${d.now()} WHERE id = $2`, [newHash, req.user!.id]);

  // Revoke all refresh tokens to force re-login on all devices
  await revokeAllUserTokens(req.user!.id);
  invalidateUserStatusCache(req.user!.id);
  clearAuthCookies(res);

  log.info(`User ${req.user!.email} changed password`);
  res.json({ message: 'Password updated successfully' });
}));

// DELETE /api/auth/account — request account deletion
//
// Verifies the user's password (when set), then routes through the
// `requestDeletion` orchestrator. The orchestrator handles sole-admin guard,
// subscription cancellation (cloud), refresh-token revocation, audit logging,
// and either schedules a hard-delete after the grace period or hard-deletes
// immediately when grace=0. The route stays thin on purpose.
router.delete('/account', authenticate, asyncHandler(async (req, res) => {
  const { password, refundPolicy } = req.body as { password?: string; refundPolicy?: 'none' | 'prorated' };
  const userId = req.user!.id;

  // Verify password when the user has one. OAuth-only users skip this check
  // (the orchestrator can't fall back to email magic-link recovery for them
  // yet, so make sure the call site is otherwise authenticated).
  const userRow = await queryOne<{ password_hash: string | null }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId],
    'User not found',
  );
  if (userRow.password_hash) {
    if (!password) {
      throw new ValidationError('Password is required');
    }
    const valid = await bcrypt.compare(password, userRow.password_hash);
    if (!valid) {
      throw new UnauthorizedError('Incorrect password');
    }
  }

  // Validate refundPolicy if provided; reject anything that isn't a known
  // value so we don't silently coerce bad input.
  if (refundPolicy !== undefined && refundPolicy !== 'none' && refundPolicy !== 'prorated') {
    throw new ValidationError('refundPolicy must be "none" or "prorated"');
  }

  const result = await requestDeletion({
    userId,
    refundPolicy: refundPolicy ?? config.deletionRefundPolicy,
  });

  clearAuthCookies(res);

  log.info(`User ${req.user!.email} initiated account deletion`);

  res.json({
    message: result.scheduledAt ? 'Account scheduled for deletion' : 'Account deleted',
    scheduledAt: result.scheduledAt,
    cancellation: result.cancellation,
  });
}));

// POST /api/auth/forgot-password — request a password reset email (no auth)
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required');
  }
  validateEmail(email.trim());

  const user = await queryMaybeOne<{ id: string; display_name: string; email: string }>(
    'SELECT id, display_name, email FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL',
    [email.trim()],
  );

  if (user) {
    if (config.baseUrl) {
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

// POST /api/auth/recover-deletion — recover a soft-deleted account (no auth — by
// design, the user can't log in while the account is in pending-deletion state).
//
// Anti-enumeration: equalize timing and use a generic 401 for all failure modes
// (no user, OAuth-only user, account not pending, wrong password). The 409 from
// `recoverDeletion` (grace expired) leaks existence — but only after the user
// has proven they own the account, which is fine.
router.post('/recover-deletion', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    throw new ValidationError('Email and password required');
  }

  const user = await queryMaybeOne<{
    id: string;
    email: string;
    password_hash: string | null;
    deletion_requested_at: string | null;
    deletion_scheduled_at: string | null;
  }>(
    'SELECT id, email, password_hash, deletion_requested_at, deletion_scheduled_at FROM users WHERE email = $1',
    [email.toLowerCase().trim()],
  );

  if (!user || !user.deletion_requested_at || !user.password_hash) {
    // Constant-time rejection to avoid leaking which of the four conditions
    // matched. The dummy bcrypt is the same one used elsewhere in this file.
    await bcrypt.compare(password, '$2b$12$000000000000000000000uVjKPCGJcotDu8bMahKn7VoPxpL0Wi');
    throw new UnauthorizedError('Invalid email or password');
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // recoverDeletion throws ConflictError if the grace window has already
  // expired. Let the global error handler surface it — a 409 leak is fine
  // here because the user has proven ownership above.
  await recoverDeletion(user.id);

  log.info(`Account deletion recovered for user ${user.email}`);
  res.json({ message: 'Account recovered. Please log in.' });
}));

// -- OAuth: Google --

router.get('/oauth/google', (_req, res) => {
  if (!config.googleClientId || !config.googleClientSecret) {
    throw new ValidationError('Google login is not configured');
  }

  const state = generateState(res);
  const { codeChallenge } = generatePkce(res);

  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: `${config.baseUrl}/api/auth/oauth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'online',
    prompt: 'select_account',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/oauth/google/callback', asyncHandler(async (req, res) => {
  const { code, state: queryState, error } = req.query as Record<string, string>;

  if (error) {
    log.warn(`Google OAuth error: ${error}`);
    res.redirect('/?oauth=error&reason=provider_denied');
    return;
  }

  try {
    validateState(req.cookies?.oauth_state, queryState);
    const codeVerifier = getCodeVerifier(req.cookies?.oauth_code_verifier);

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.googleClientId!,
        client_secret: config.googleClientSecret!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${config.baseUrl}/api/auth/oauth/google/callback`,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      log.error(`Google token exchange failed: ${tokenRes.status} ${body}`);
      res.redirect('/?oauth=error&reason=token_exchange_failed');
      return;
    }

    const tokens = await tokenRes.json() as { id_token: string };

    const { payload } = await jose.jwtVerify(tokens.id_token, googleJwks(), {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: config.googleClientId!,
    });

    if (!payload.email_verified) {
      log.warn('Google OAuth: email not verified');
      res.redirect('/?oauth=error&reason=email_not_verified');
      return;
    }

    const email = payload.email as string;
    const displayName = (payload.name as string) || email.split('@')[0];
    const sub = payload.sub!;

    clearOAuthCookies(res);

    const { user } = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: sub,
      email,
      displayName,
    });

    await finalizeOAuthLogin(req, res, user, 'google');
  } catch (err) {
    clearOAuthCookies(res);
    log.error('Google OAuth callback error:', err);
    res.redirect('/?oauth=error&reason=callback_failed');
  }
}));

// -- OAuth: Apple --

router.get('/oauth/apple', (_req, res) => {
  if (!config.appleClientId || !config.appleTeamId || !config.appleKeyId || !config.applePrivateKey) {
    throw new ValidationError('Apple login is not configured');
  }

  const state = generateState(res);
  const { nonceHash } = generateNonce(res);

  const params = new URLSearchParams({
    client_id: config.appleClientId,
    redirect_uri: `${config.baseUrl}/api/auth/oauth/apple/callback`,
    response_type: 'code id_token',
    scope: 'name email',
    state,
    nonce: nonceHash,
    response_mode: 'form_post',
  });

  res.redirect(`https://appleid.apple.com/auth/authorize?${params}`);
});

router.post('/oauth/apple/callback', asyncHandler(async (req, res) => {
  const { state: formState, id_token: idToken, error: appleError } = req.body;

  if (appleError) {
    log.warn(`Apple OAuth error: ${appleError}`);
    res.redirect('/?oauth=error&reason=provider_denied');
    return;
  }

  try {
    validateState(req.cookies?.oauth_state, formState);
    const expectedNonce = req.cookies?.oauth_nonce;

    const { payload } = await jose.jwtVerify(idToken, appleJwks(), {
      issuer: 'https://appleid.apple.com',
      audience: config.appleClientId!,
    });

    if (!expectedNonce) {
      log.warn('Apple OAuth: nonce cookie missing');
      res.redirect('/?oauth=error&reason=missing_nonce');
      return;
    }

    const expectedHash = crypto.createHash('sha256').update(expectedNonce).digest('hex');
    if (payload.nonce !== expectedHash) {
      log.warn('Apple OAuth: nonce mismatch');
      res.redirect('/?oauth=error&reason=nonce_mismatch');
      return;
    }

    const email = payload.email as string | undefined;
    const sub = payload.sub!;

    const appleUser = req.body.user ? (typeof req.body.user === 'string' ? JSON.parse(req.body.user) : req.body.user) : null;
    const displayName = appleUser?.name
      ? [appleUser.name.firstName, appleUser.name.lastName].filter(Boolean).join(' ')
      : email?.split('@')[0] || 'User';

    clearOAuthCookies(res);

    if (!email) {
      log.warn('Apple OAuth: no email provided');
      res.redirect('/?oauth=error&reason=no_email');
      return;
    }

    const { user } = await findOrCreateOAuthUser({
      provider: 'apple',
      providerUserId: sub,
      email,
      displayName,
    });

    await finalizeOAuthLogin(req, res, user, 'apple');
  } catch (err) {
    clearOAuthCookies(res);
    log.error('Apple OAuth callback error:', err);
    res.redirect('/?oauth=error&reason=callback_failed');
  }
}));

// -- OAuth: Account linking --

router.get('/oauth/links', authenticate, asyncHandler(async (req, res) => {
  const links = await query<{ provider: string; email: string | null; created_at: string }>(
    'SELECT provider, email, created_at FROM user_oauth_links WHERE user_id = $1',
    [req.user!.id]
  );
  res.json({ results: links.rows });
}));

router.delete('/oauth/link/:provider', authenticate, asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const userId = req.user!.id;

  const userRow = await queryMaybeOne<{ password_hash: string | null }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId],
  );
  const hasPassword = !!userRow?.password_hash;

  const linkCount = await query<{ count: number }>(
    'SELECT COUNT(*) as count FROM user_oauth_links WHERE user_id = $1',
    [userId]
  );
  const totalLinks = Number(linkCount.rows[0]?.count ?? 0);

  if (!hasPassword && totalLinks <= 1) {
    throw new ValidationError('Set a password before disconnecting your last login method');
  }

  const result = await query(
    'DELETE FROM user_oauth_links WHERE user_id = $1 AND provider = $2',
    [userId, provider]
  );

  if (result.rowCount === 0) {
    throw new NotFoundError('Provider not linked');
  }

  log.info(`User "${req.user!.email}" unlinked ${provider}`);
  res.json({ success: true });
}));

export default router;
