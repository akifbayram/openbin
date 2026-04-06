import crypto from 'node:crypto';
import type { Response } from 'express';
import * as jose from 'jose';
import { generateUuid, query, withTransaction } from '../db.js';
import { signToken } from '../middleware/auth.js';
import { config } from './config.js';
import { setAccessTokenCookie, setRefreshTokenCookie } from './cookies.js';
import { ForbiddenError, UnauthorizedError } from './httpErrors.js';
import { createLogger } from './logger.js';
import { Plan, SubStatus } from './planGate.js';
import { createRefreshToken } from './refreshTokens.js';

const log = createLogger('oauth');

// -- State / PKCE / Nonce helpers --

const OAUTH_STATE_MAX_AGE = 10 * 60; // 10 minutes in seconds

function cookieOpts(maxAge: number): import('express').CookieOptions {
  return { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', maxAge: maxAge * 1000, path: '/' };
}

export function generateState(res: Response): string {
  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('oauth_state', state, cookieOpts(OAUTH_STATE_MAX_AGE));
  return state;
}

export function validateState(cookieState: string | undefined, queryState: string | undefined): void {
  if (!cookieState || !queryState || cookieState !== queryState) {
    throw new UnauthorizedError('Invalid OAuth state');
  }
}

export function clearOAuthCookies(res: Response): void {
  for (const name of ['oauth_state', 'oauth_code_verifier', 'oauth_nonce']) {
    res.clearCookie(name, { path: '/' });
  }
}

export function generatePkce(res: Response): { codeChallenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  res.cookie('oauth_code_verifier', verifier, cookieOpts(OAUTH_STATE_MAX_AGE));
  return { codeChallenge: challenge };
}

export function getCodeVerifier(cookieValue: string | undefined): string {
  if (!cookieValue) throw new UnauthorizedError('Missing PKCE verifier');
  return cookieValue;
}

export function generateNonce(res: Response): { nonce: string; nonceHash: string } {
  const nonce = crypto.randomBytes(32).toString('hex');
  const nonceHash = crypto.createHash('sha256').update(nonce).digest('hex');
  res.cookie('oauth_nonce', nonce, cookieOpts(OAUTH_STATE_MAX_AGE));
  return { nonce, nonceHash };
}

// -- JWKS caching --

const jwksCache = new Map<string, ReturnType<typeof jose.createRemoteJWKSet>>();

function getJwks(url: string): ReturnType<typeof jose.createRemoteJWKSet> {
  let cached = jwksCache.get(url);
  if (!cached) {
    cached = jose.createRemoteJWKSet(new URL(url));
    jwksCache.set(url, cached);
  }
  return cached;
}

export const googleJwks = () => getJwks('https://www.googleapis.com/oauth2/v3/certs');
export const appleJwks = () => getJwks('https://appleid.apple.com/auth/keys');

// -- Apple client secret generation --

export async function generateAppleClientSecret(): Promise<string> {
  if (!config.applePrivateKey || !config.appleKeyId || !config.appleTeamId || !config.appleClientId) {
    throw new Error('Apple OAuth not configured');
  }
  const key = await jose.importPKCS8(config.applePrivateKey, 'ES256');
  return new jose.SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.appleKeyId })
    .setIssuer(config.appleTeamId)
    .setAudience('https://appleid.apple.com')
    .setSubject(config.appleClientId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

// -- Username generation --

export async function generateUsername(email: string): Promise<string> {
  const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 50);
  const base = prefix || 'user';

  // Single query to find all taken usernames matching base or base+N
  const taken = await query<{ username: string }>(
    "SELECT username FROM users WHERE username = $1 OR username LIKE $1 || '%'",
    [base]
  );
  const takenSet = new Set(taken.rows.map((r) => r.username));

  if (!takenSet.has(base)) return base;

  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}${i}`.slice(0, 50);
    if (!takenSet.has(candidate)) return candidate;
  }

  return `${base}_${crypto.randomBytes(4).toString('hex')}`;
}

// -- Find or create OAuth user --

interface OAuthUserInput {
  provider: string;
  providerUserId: string;
  email: string;
  displayName: string;
}

interface OAuthUserResult {
  user: { id: string; username: string; token_version: number };
  created: boolean;
}

export async function findOrCreateOAuthUser(input: OAuthUserInput): Promise<OAuthUserResult> {
  const { provider, providerUserId, email, displayName } = input;

  // 1. Check if this provider identity is already linked
  const linkResult = await query<{ user_id: string }>(
    'SELECT user_id FROM user_oauth_links WHERE provider = $1 AND provider_user_id = $2',
    [provider, providerUserId]
  );

  if (linkResult.rows.length > 0) {
    const userId = linkResult.rows[0].user_id;
    const userResult = await query<{ id: string; username: string; token_version: number; deleted_at: string | null; suspended_at: string | null }>(
      'SELECT id, username, token_version, deleted_at, suspended_at FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    if (!user || user.deleted_at) throw new UnauthorizedError('Account not found');
    if (user.suspended_at) throw new ForbiddenError('This account has been suspended');
    return { user: { id: user.id, username: user.username, token_version: user.token_version }, created: false };
  }

  // 2. Check if email matches an existing user (auto-link)
  if (email) {
    const emailResult = await query<{ id: string; username: string; token_version: number; deleted_at: string | null; suspended_at: string | null }>(
      'SELECT id, username, token_version, deleted_at, suspended_at FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (emailResult.rows.length > 0) {
      const user = emailResult.rows[0];
      if (user.deleted_at) throw new UnauthorizedError('Account not found');
      if (user.suspended_at) throw new ForbiddenError('This account has been suspended');

      await query(
        'INSERT INTO user_oauth_links (id, user_id, provider, provider_user_id, email) VALUES ($1, $2, $3, $4, $5)',
        [generateUuid(), user.id, provider, providerUserId, email]
      );
      log.info(`Auto-linked ${provider} account to existing user "${user.username}"`);
      return { user: { id: user.id, username: user.username, token_version: user.token_version }, created: false };
    }
  }

  // 3. Create new user (transactional to prevent partial inserts on concurrent requests)
  const username = await generateUsername(email);
  const userId = generateUuid();

  await withTransaction(async (txQuery) => {
    await txQuery(
      `INSERT INTO users (id, username, password_hash, display_name, email, plan, sub_status, active_until)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)`,
      [
        userId,
        username,
        displayName || username,
        email,
        Plan.PLUS,
        SubStatus.TRIAL,
        new Date(Date.now() + config.trialPeriodDays * 24 * 60 * 60 * 1000).toISOString(),
      ]
    );

    await txQuery(
      'INSERT INTO user_oauth_links (id, user_id, provider, provider_user_id, email) VALUES ($1, $2, $3, $4, $5)',
      [generateUuid(), userId, provider, providerUserId, email]
    );
  });

  log.info(`Created new user "${username}" via ${provider} OAuth`);
  return { user: { id: userId, username, token_version: 0 }, created: true };
}

// -- Finalize OAuth login (issue tokens, record history, redirect) --

export async function finalizeOAuthLogin(
  req: import('express').Request,
  res: Response,
  user: { id: string; username: string; token_version: number },
  provider: string,
): Promise<void> {
  const accessToken = await signToken({ id: user.id, username: user.username }, user.token_version);
  const refresh = await createRefreshToken(user.id);
  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refresh.rawToken);

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
  const ua = req.headers['user-agent'] || '';
  query('INSERT INTO login_history (id, user_id, ip_address, user_agent, method, success) VALUES ($1, $2, $3, $4, $5, 1)',
    [generateUuid(), user.id, ip, ua, provider]).catch(() => {});

  log.info(`User "${user.username}" logged in via ${provider} OAuth`);
  res.redirect('/?oauth=success');
}

// -- Available providers --

export function getOAuthProviders(): string[] {
  if (config.selfHosted) return [];
  const providers: string[] = [];
  if (config.googleClientId && config.googleClientSecret) providers.push('google');
  if (config.appleClientId && config.appleTeamId && config.appleKeyId && config.applePrivateKey) providers.push('apple');
  return providers;
}
