# Social Login (Google & Apple) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Continue with Google" and "Continue with Apple" to OpenBin cloud login/register with auto-linking by verified email.

**Architecture:** Direct OAuth2/OIDC against Google and Apple REST APIs. New `user_oauth_links` table links provider identities to users. Shared `server/src/lib/oauth.ts` module handles state/PKCE/nonce management, JWKS caching, token exchange, and user find-or-create logic. Client buttons are plain links to server redirect endpoints — no client-side OAuth SDK.

**Tech Stack:** `jose` (already installed) for JWKS verification and Apple client secret JWT. Node built-in `fetch` for provider API calls. Express routes, SQLite/PostgreSQL dual schema.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `server/src/lib/config.ts` | Modify | Add 6 OAuth env vars |
| `server/schema.sqlite.sql` | Modify | Add `user_oauth_links` table |
| `server/schema.pg.sql` | Modify | Add `user_oauth_links` table (PostgreSQL) |
| `server/src/db/init.ts` | Modify | Add `user_oauth_links` CREATE TABLE + inline migration for `password_hash` nullable |
| `server/src/lib/oauth.ts` | Create | Shared OAuth logic: state, PKCE, nonce, JWKS, username gen, find-or-create |
| `server/src/routes/auth.ts` | Modify | Add OAuth routes + update `/status` endpoint |
| `src/features/auth/LoginPage.tsx` | Modify | Add social login buttons |
| `src/features/auth/RegisterPage.tsx` | Modify | Add social login buttons |
| `src/features/auth/OAuthReturn.tsx` | Create | Handle `?oauth=success\|error` query params |
| `src/features/auth/SocialButtons.tsx` | Create | Shared social login button component |
| `src/features/settings/sections/AccountSection.tsx` | Modify | Add "Connected Accounts" section |
| `server/src/__tests__/oauth.test.ts` | Create | Server-side OAuth tests |
| `src/features/auth/__tests__/SocialButtons.test.tsx` | Create | Client social button tests |

---

## Task 1: Config — Add OAuth environment variables

**Files:**
- Modify: `server/src/lib/config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add OAuth env vars to config.ts**

In `server/src/lib/config.ts`, add after the `subscriptionWebhookSecret` line (~line 78):

```typescript
  // OAuth (cloud only)
  googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
  appleClientId: process.env.APPLE_CLIENT_ID || null,
  appleTeamId: process.env.APPLE_TEAM_ID || null,
  appleKeyId: process.env.APPLE_KEY_ID || null,
  applePrivateKey: process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || null,
```

Note: `APPLE_PRIVATE_KEY` needs `\\n` to `\n` conversion because PEM keys are often passed as single-line env vars with literal `\n`.

- [ ] **Step 2: Add to .env.example**

Add to `.env.example` in the auth section:

```
# OAuth (cloud only — omit for self-hosted)
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# APPLE_CLIENT_ID=
# APPLE_TEAM_ID=
# APPLE_KEY_ID=
# APPLE_PRIVATE_KEY=
```

- [ ] **Step 3: Verify type check**

Run: `cd server && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```
git add server/src/lib/config.ts .env.example
git commit -m "feat: add OAuth env vars to config"
```

---

## Task 2: Database — Add `user_oauth_links` table and make `password_hash` nullable

**Files:**
- Modify: `server/schema.sqlite.sql`
- Modify: `server/schema.pg.sql`
- Modify: `server/src/db/init.ts`

- [ ] **Step 1: Add table to SQLite schema**

In `server/schema.sqlite.sql`, after the `login_history` table definition, add:

```sql
-- OAuth provider links (cloud social login)
CREATE TABLE IF NOT EXISTS user_oauth_links (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  email            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_provider_user ON user_oauth_links(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_user_id ON user_oauth_links(user_id);
```

- [ ] **Step 2: Add table to PostgreSQL schema**

In `server/schema.pg.sql`, after the `login_history` table definition, add:

```sql
-- OAuth provider links (cloud social login)
CREATE TABLE IF NOT EXISTS user_oauth_links (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  email            TEXT,
  created_at       TEXT NOT NULL DEFAULT (NOW())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_provider_user ON user_oauth_links(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_user_id ON user_oauth_links(user_id);
```

- [ ] **Step 3: Add inline migration in init.ts**

In `server/src/db/init.ts`, in the SQLite branch, after the last `db.exec(...)` block for table creation, add:

```typescript
  // OAuth provider links
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_oauth_links (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider         TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      email            TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_provider_user ON user_oauth_links(provider, provider_user_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_user_id ON user_oauth_links(user_id);
  `);
```

In the PostgreSQL branch, add the equivalent with `DEFAULT (NOW())`.

For making `password_hash` nullable — SQLite cannot `ALTER COLUMN` to drop NOT NULL. Instead, new installs get it nullable from `schema.sqlite.sql`, and for existing DBs this requires a table rebuild migration. However, since this is cloud-only and the cloud DB is PostgreSQL, add the PostgreSQL migration:

In the PostgreSQL init branch, add:

```typescript
  // Allow null password_hash for OAuth-only users
  await pgQuery('ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL');
```

For the SQLite schema files, change `password_hash TEXT NOT NULL` to `password_hash TEXT` in `schema.sqlite.sql` (this only affects fresh installs). For existing SQLite databases in self-hosted mode, OAuth is not available so no migration needed.

- [ ] **Step 4: Update the `password_hash` column in schema.sqlite.sql**

Change the users table `password_hash TEXT NOT NULL` to `password_hash TEXT` in `server/schema.sqlite.sql`.

- [ ] **Step 5: Update the `password_hash` column in schema.pg.sql**

Change the users table `password_hash TEXT NOT NULL` to `password_hash TEXT` in `server/schema.pg.sql`.

- [ ] **Step 6: Verify server starts**

Run: `npm run dev:server` — verify no errors on startup, then kill.

- [ ] **Step 7: Commit**

```
git add server/schema.sqlite.sql server/schema.pg.sql server/src/db/init.ts
git commit -m "feat: add user_oauth_links table, make password_hash nullable"
```

---

## Task 3: Server — Shared OAuth helper module

**Files:**
- Create: `server/src/lib/oauth.ts`

- [ ] **Step 1: Write tests for username generation and find-or-create logic**

Create `server/src/__tests__/oauth.test.ts`:

```typescript
import type { Express } from 'express';
import { beforeEach, describe, expect, it } from 'vitest';
import { generateUuid, query } from '../db.js';
import { createApp } from '../index.js';
import { findOrCreateOAuthUser, generateUsername } from '../lib/oauth.js';
import { createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('generateUsername', () => {
  it('extracts prefix from email', async () => {
    const name = await generateUsername('jane.doe@gmail.com');
    expect(name).toBe('janedoe');
  });

  it('strips non-alphanumeric/underscore chars', async () => {
    const name = await generateUsername('j+a.n-e@example.com');
    expect(name).toBe('jane');
  });

  it('truncates to 50 chars', async () => {
    const long = 'a'.repeat(60) + '@example.com';
    const name = await generateUsername(long);
    expect(name.length).toBeLessThanOrEqual(50);
  });

  it('appends numeric suffix on conflict', async () => {
    await createTestUser(app, { username: 'testconflict' });
    const name = await generateUsername('testconflict@example.com');
    expect(name).toBe('testconflict2');
  });

  it('increments suffix until unique', async () => {
    await createTestUser(app, { username: 'dupuser' });
    await query(
      "INSERT INTO users (id, username, password_hash, display_name, plan, sub_status) VALUES ($1, $2, $3, $4, 1, 1)",
      [generateUuid(), 'dupuser2', 'hash', 'dup']
    );
    const name = await generateUsername('dupuser@example.com');
    expect(name).toBe('dupuser3');
  });

  it('falls back to "user" for empty prefix', async () => {
    const name = await generateUsername('@example.com');
    expect(name).toBe('user');
  });
});

describe('findOrCreateOAuthUser', () => {
  it('creates new user when no match exists', async () => {
    const result = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-123',
      email: 'newuser@example.com',
      displayName: 'New User',
    });
    expect(result.user.username).toBeTruthy();
    expect(result.created).toBe(true);
  });

  it('returns existing user when oauth link exists', async () => {
    const first = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-456',
      email: 'existing@example.com',
      displayName: 'Existing',
    });
    const second = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-456',
      email: 'existing@example.com',
      displayName: 'Existing',
    });
    expect(second.user.id).toBe(first.user.id);
    expect(second.created).toBe(false);
  });

  it('auto-links when email matches existing password user', async () => {
    const { user } = await createTestUser(app, { email: 'link@example.com' });
    const result = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-789',
      email: 'link@example.com',
      displayName: 'Linked',
    });
    expect(result.user.id).toBe(user.id);
    expect(result.created).toBe(false);
  });

  it('rejects suspended user', async () => {
    const result = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-suspend',
      email: 'suspended@example.com',
      displayName: 'Suspended',
    });
    await query("UPDATE users SET suspended_at = datetime('now') WHERE id = $1", [result.user.id]);
    await expect(
      findOrCreateOAuthUser({
        provider: 'google',
        providerUserId: 'google-sub-suspend',
        email: 'suspended@example.com',
        displayName: 'Suspended',
      })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/__tests__/oauth.test.ts`
Expected: FAIL — `oauth.js` module not found

- [ ] **Step 3: Implement `server/src/lib/oauth.ts`**

```typescript
import crypto from 'node:crypto';
import * as jose from 'jose';
import { generateUuid, query } from '../db.js';
import { config } from './config.js';
import { ForbiddenError, UnauthorizedError } from './httpErrors.js';
import { createLogger } from './logger.js';
import { Plan, SubStatus } from './planGate.js';

import type { Response } from 'express';

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
  for (const name of ['oauth_state', 'oauth_code_verifier', 'oauth_nonce', 'oauth_linking']) {
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

  const existing = await query('SELECT 1 FROM users WHERE username = $1', [base]);
  if (existing.rows.length === 0) return base;

  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}${i}`.slice(0, 50);
    const check = await query('SELECT 1 FROM users WHERE username = $1', [candidate]);
    if (check.rows.length === 0) return candidate;
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

  // 3. Create new user
  const username = await generateUsername(email);
  const userId = generateUuid();

  await query(
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

  await query(
    'INSERT INTO user_oauth_links (id, user_id, provider, provider_user_id, email) VALUES ($1, $2, $3, $4, $5)',
    [generateUuid(), userId, provider, providerUserId, email]
  );

  log.info(`Created new user "${username}" via ${provider} OAuth`);
  return { user: { id: userId, username, token_version: 0 }, created: true };
}

// -- Available providers --

export function getOAuthProviders(): string[] {
  if (config.selfHosted) return [];
  const providers: string[] = [];
  if (config.googleClientId && config.googleClientSecret) providers.push('google');
  if (config.appleClientId && config.appleTeamId && config.appleKeyId && config.applePrivateKey) providers.push('apple');
  return providers;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/__tests__/oauth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add server/src/lib/oauth.ts server/src/__tests__/oauth.test.ts
git commit -m "feat: add shared OAuth helper module with tests"
```

---

## Task 4: Server — OAuth routes (Google)

**Files:**
- Modify: `server/src/routes/auth.ts`

- [ ] **Step 1: Add imports and update /status endpoint**

Add imports at the top of `server/src/routes/auth.ts`:

```typescript
import crypto from 'node:crypto';
import {
  clearOAuthCookies,
  findOrCreateOAuthUser,
  generatePkce,
  generateState,
  getCodeVerifier,
  getOAuthProviders,
  googleJwks,
  validateState,
} from '../lib/oauth.js';
```

In the existing `router.get('/status', ...)` handler, add `oauthProviders` to the response body object, after the `selfHosted` line:

```typescript
    oauthProviders: getOAuthProviders(),
```

- [ ] **Step 2: Add Google OAuth routes**

Add after the existing auth routes (before `export { router as authRouter }`):

```typescript
// -- OAuth: Google --

router.get('/oauth/google', (req, res) => {
  if (!config.googleClientId || !config.googleClientSecret) {
    throw new ValidationError('Google login is not configured');
  }

  const state = generateState(res);
  const { codeChallenge } = generatePkce(res);

  const linking = !!(req as any).cookies?.['openbin-access'];
  if (linking) res.cookie('oauth_linking', '1', { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', maxAge: 600_000, path: '/' });

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

    const accessToken = await signToken({ id: user.id, username: user.username }, user.token_version);
    const refresh = await createRefreshToken(user.id);
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refresh.rawToken);

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
    const ua = req.headers['user-agent'] || '';
    query('INSERT INTO login_history (id, user_id, ip_address, user_agent, method, success) VALUES ($1, $2, $3, $4, $5, 1)',
      [generateUuid(), user.id, ip, ua, 'google']).catch(() => {});

    log.info(`User "${user.username}" logged in via Google OAuth`);
    res.redirect('/?oauth=success');
  } catch (err) {
    clearOAuthCookies(res);
    log.error('Google OAuth callback error:', err);
    res.redirect('/?oauth=error&reason=callback_failed');
  }
}));
```

- [ ] **Step 3: Verify type check**

Run: `cd server && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```
git add server/src/routes/auth.ts
git commit -m "feat: add Google OAuth routes"
```

---

## Task 5: Server — OAuth routes (Apple)

**Files:**
- Modify: `server/src/routes/auth.ts`

- [ ] **Step 1: Add Apple imports**

Extend the oauth import at the top to include Apple-specific helpers:

```typescript
import {
  // ... existing imports ...
  appleJwks,
  generateAppleClientSecret,
  generateNonce,
} from '../lib/oauth.js';
```

- [ ] **Step 2: Add Apple OAuth routes**

Add after the Google routes:

```typescript
// -- OAuth: Apple --

router.get('/oauth/apple', (req, res) => {
  if (!config.appleClientId || !config.appleTeamId || !config.appleKeyId || !config.applePrivateKey) {
    throw new ValidationError('Apple login is not configured');
  }

  const state = generateState(res);
  const { nonceHash } = generateNonce(res);

  const linking = !!(req as any).cookies?.['openbin-access'];
  if (linking) res.cookie('oauth_linking', '1', { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', maxAge: 600_000, path: '/' });

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
  const { code, state: formState, id_token: idToken, error: appleError } = req.body;

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

    if (expectedNonce) {
      const expectedHash = crypto.createHash('sha256').update(expectedNonce).digest('hex');
      if (payload.nonce !== expectedHash) {
        log.warn('Apple OAuth: nonce mismatch');
        res.redirect('/?oauth=error&reason=nonce_mismatch');
        return;
      }
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

    const accessToken = await signToken({ id: user.id, username: user.username }, user.token_version);
    const refresh = await createRefreshToken(user.id);
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refresh.rawToken);

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
    const ua = req.headers['user-agent'] || '';
    query('INSERT INTO login_history (id, user_id, ip_address, user_agent, method, success) VALUES ($1, $2, $3, $4, $5, 1)',
      [generateUuid(), user.id, ip, ua, 'apple']).catch(() => {});

    log.info(`User "${user.username}" logged in via Apple OAuth`);
    res.redirect('/?oauth=success');
  } catch (err) {
    clearOAuthCookies(res);
    log.error('Apple OAuth callback error:', err);
    res.redirect('/?oauth=error&reason=callback_failed');
  }
}));
```

- [ ] **Step 3: Verify type check**

Run: `cd server && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```
git add server/src/routes/auth.ts
git commit -m "feat: add Apple OAuth routes"
```

---

## Task 6: Server — Link/unlink routes, NO_PASSWORD login, and hasPassword in /me

**Files:**
- Modify: `server/src/routes/auth.ts`

- [ ] **Step 1: Add link, unlink, and list routes**

Add after the Apple routes:

```typescript
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

  const userResult = await query<{ password_hash: string | null }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );
  const hasPassword = !!userResult.rows[0]?.password_hash;

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

  if ((result as any).rowCount === 0 && (result as any).changes === 0) {
    throw new NotFoundError('Provider not linked');
  }

  log.info(`User "${req.user!.username}" unlinked ${provider}`);
  res.json({ success: true });
}));
```

- [ ] **Step 2: Handle NO_PASSWORD in login route**

In the existing `POST /api/auth/login` route, after fetching the user and before the `bcrypt.compare` call (~line 265), add:

```typescript
  if (!user.password_hash) {
    log.warn(`Login failed: no password set for "${username}" (social-only account)`);
    query('INSERT INTO login_history (id, user_id, ip_address, user_agent, method, success) VALUES ($1, $2, $3, $4, $5, 0)',
      [generateUuid(), user.id, ip, ua, 'password']).catch(() => {});
    res.status(401).json({ error: 'NO_PASSWORD', message: 'This account uses social login. Sign in with Google or Apple, or set a password from account settings.' });
    return;
  }
```

- [ ] **Step 3: Add `hasPassword` to the /me response**

Find the `GET /api/auth/me` route. In the user response object, add:

```typescript
  hasPassword: !!user.password_hash,
```

Make sure the SELECT query for `/me` includes `password_hash` in its column list.

- [ ] **Step 4: Update User type**

In `src/types.ts`, add to the `User` interface:

```typescript
  hasPassword?: boolean;
```

- [ ] **Step 5: Allow social-only users to set first password**

In the `PUT /api/auth/password` handler, after fetching the user and before the current password check, add:

```typescript
  // Social-only users setting their first password
  if (!user.password_hash) {
    if (!newPassword) throw new ValidationError('New password is required');
    validatePassword(newPassword);
    const hash = await bcrypt.hash(newPassword, config.bcryptRounds);
    await query('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3',
      [hash, new Date().toISOString(), req.user!.id]);
    await revokeAllUserTokens(req.user!.id);
    res.json({ message: 'Password set successfully' });
    return;
  }
```

- [ ] **Step 6: Verify type check**

Run: `cd server && npx tsc --noEmit && npx tsc --noEmit` (from root for frontend types too)
Expected: PASS

- [ ] **Step 7: Commit**

```
git add server/src/routes/auth.ts src/types.ts
git commit -m "feat: add OAuth link/unlink routes, NO_PASSWORD handling, hasPassword in /me"
```

---

## Task 7: Client — Social login buttons component

**Files:**
- Create: `src/features/auth/SocialButtons.tsx`

- [ ] **Step 1: Create the shared button component**

```tsx
import { cn, focusRing } from '@/lib/utils';

const PROVIDERS = {
  google: {
    label: 'Continue with Google',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
    ),
  },
  apple: {
    label: 'Continue with Apple',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-1.55 4.3-3.74 4.25z" />
      </svg>
    ),
  },
} as const;

interface SocialButtonsProps {
  providers: string[];
}

export function SocialButtons({ providers }: SocialButtonsProps) {
  if (providers.length === 0) return null;

  return (
    <div className="space-y-2">
      {providers.map((provider) => {
        const p = PROVIDERS[provider as keyof typeof PROVIDERS];
        if (!p) return null;
        return (
          <a
            key={provider}
            href={`/api/auth/oauth/${provider}`}
            className={cn(
              'flex items-center justify-center gap-2.5 w-full h-11 rounded-[var(--radius-sm)] border border-[var(--border-flat)] bg-[var(--bg-base)] hover:bg-[var(--bg-hover)] transition-colors text-[15px] font-medium text-[var(--text-primary)]',
              focusRing,
            )}
          >
            {p.icon}
            {p.label}
          </a>
        );
      })}
    </div>
  );
}

export function SocialDivider() {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 border-t border-[var(--border-subtle)]" />
      <span className="text-[13px] text-[var(--text-tertiary)]">or</span>
      <div className="flex-1 border-t border-[var(--border-subtle)]" />
    </div>
  );
}
```

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```
git add src/features/auth/SocialButtons.tsx
git commit -m "feat: add social login button component"
```

---

## Task 8: Client — Add social buttons to LoginPage and RegisterPage

**Files:**
- Modify: `src/features/auth/LoginPage.tsx`
- Modify: `src/features/auth/RegisterPage.tsx`

- [ ] **Step 1: Update LoginPage**

Add import:

```typescript
import { SocialButtons, SocialDivider } from './SocialButtons';
```

Add state:

```typescript
const [oauthProviders, setOAuthProviders] = useState<string[]>([]);
```

Update the existing `/api/auth/status` fetch effect to read `oauthProviders`:

```typescript
if (Array.isArray(data.oauthProviders)) setOAuthProviders(data.oauthProviders);
```

Inside `<CardContent>`, before the `<form>`, add:

```tsx
<SocialButtons providers={oauthProviders} />
{oauthProviders.length > 0 && <SocialDivider />}
```

- [ ] **Step 2: Update RegisterPage**

Same pattern as LoginPage — add state, read from status, render buttons above the form.

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```
git add src/features/auth/LoginPage.tsx src/features/auth/RegisterPage.tsx
git commit -m "feat: add social login buttons to login and register pages"
```

---

## Task 9: Client — OAuth return handler

**Files:**
- Create: `src/features/auth/OAuthReturn.tsx`
- Modify: `src/features/auth/LoginPage.tsx`

- [ ] **Step 1: Create OAuthReturn component**

```tsx
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';

const ERROR_MESSAGES: Record<string, string> = {
  provider_denied: 'Sign-in was cancelled',
  token_exchange_failed: 'Authentication failed — please try again',
  email_not_verified: 'Your email must be verified with the provider',
  nonce_mismatch: 'Authentication failed — please try again',
  callback_failed: 'Authentication failed — please try again',
  no_email: 'An email address is required to sign in',
  invalid_flow: 'Invalid authentication flow',
};

export function useOAuthReturn() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { refreshSession } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    const oauth = searchParams.get('oauth');
    if (!oauth) return;

    if (oauth === 'success') {
      refreshSession();
    } else if (oauth === 'error') {
      const reason = searchParams.get('reason') || 'callback_failed';
      showToast({
        message: ERROR_MESSAGES[reason] || 'Authentication failed',
        variant: 'error',
      });
    }

    setSearchParams((prev) => {
      prev.delete('oauth');
      prev.delete('reason');
      return prev;
    }, { replace: true });
  }, []);
}
```

- [ ] **Step 2: Use in LoginPage**

In `LoginPage.tsx`, import and call:

```typescript
import { useOAuthReturn } from './OAuthReturn';
// Inside the component:
useOAuthReturn();
```

The hook handles the `?oauth=success` redirect — it calls `refreshSession()` which loads the user from the cookie tokens, then the existing `useAuth` state change triggers navigation to `/`.

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```
git add src/features/auth/OAuthReturn.tsx src/features/auth/LoginPage.tsx
git commit -m "feat: handle OAuth return query params"
```

---

## Task 10: Client — Connected Accounts section in settings

**Files:**
- Modify: `src/features/settings/sections/AccountSection.tsx`

- [ ] **Step 1: Add Connected Accounts section**

Add imports:

```typescript
import { Link2, Link2Off } from 'lucide-react';
```

Add state and fetch inside the component (after existing state):

```typescript
const [oauthLinks, setOauthLinks] = useState<{ provider: string; email: string | null; created_at: string }[]>([]);
const [oauthProviders, setOauthProviders] = useState<string[]>([]);
const [unlinking, setUnlinking] = useState<string | null>(null);
const hasPassword = user?.hasPassword !== false;

useEffect(() => {
  fetch('/api/auth/status')
    .then((r) => r.json())
    .then((data) => {
      if (Array.isArray(data.oauthProviders)) setOauthProviders(data.oauthProviders);
    })
    .catch(() => {});

  apiFetch<{ results: { provider: string; email: string | null; created_at: string }[] }>('/api/auth/oauth/links')
    .then((data) => setOauthLinks(data.results))
    .catch(() => {});
}, []);
```

Add between the Password section and Danger Zone section:

```tsx
{oauthProviders.length > 0 && (
  <SettingsSection label="Connected Accounts">
    <div className="divide-y divide-[var(--border-subtle)]">
      {oauthProviders.map((provider) => {
        const link = oauthLinks.find((l) => l.provider === provider);
        const providerLabel = provider === 'google' ? 'Google' : 'Apple';
        const canUnlink = oauthLinks.length > 1 || hasPassword;

        return (
          <div key={provider} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--bg-active)] flex items-center justify-center">
                <Link2 className="h-4 w-4 text-[var(--text-secondary)]" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-[var(--text-primary)]">{providerLabel}</p>
                <p className="text-[12px] text-[var(--text-tertiary)]">
                  {link ? (link.email || 'Connected') : 'Not connected'}
                </p>
              </div>
            </div>
            {link ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={!canUnlink || unlinking === provider}
                onClick={async () => {
                  setUnlinking(provider);
                  try {
                    await apiFetch(`/api/auth/oauth/link/${provider}`, { method: 'DELETE' });
                    setOauthLinks((prev) => prev.filter((l) => l.provider !== provider));
                    showToast({ message: `${providerLabel} disconnected`, variant: 'success' });
                  } catch (err) {
                    showToast({ message: getErrorMessage(err, `Failed to disconnect ${providerLabel}`), variant: 'error' });
                  } finally {
                    setUnlinking(null);
                  }
                }}
                title={!canUnlink ? 'Set a password before disconnecting your last login method' : undefined}
              >
                {unlinking === provider ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4 mr-1.5" />}
                Disconnect
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { window.location.href = `/api/auth/oauth/${provider}`; }}
              >
                <Link2 className="h-4 w-4 mr-1.5" />
                Connect
              </Button>
            )}
          </div>
        );
      })}
    </div>
  </SettingsSection>
)}
```

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```
git add src/features/settings/sections/AccountSection.tsx
git commit -m "feat: add connected accounts section to settings"
```

---

## Task 11: Client tests — Social buttons

**Files:**
- Create: `src/features/auth/__tests__/SocialButtons.test.tsx`

- [ ] **Step 1: Write tests**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SocialButtons } from '../SocialButtons';

describe('SocialButtons', () => {
  it('renders nothing when providers list is empty', () => {
    const { container } = render(<SocialButtons providers={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Google button when google is in providers', () => {
    render(<SocialButtons providers={['google']} />);
    expect(screen.getByText('Continue with Google')).toBeTruthy();
  });

  it('renders Apple button when apple is in providers', () => {
    render(<SocialButtons providers={['apple']} />);
    expect(screen.getByText('Continue with Apple')).toBeTruthy();
  });

  it('renders both buttons when both providers present', () => {
    render(<SocialButtons providers={['google', 'apple']} />);
    expect(screen.getByText('Continue with Google')).toBeTruthy();
    expect(screen.getByText('Continue with Apple')).toBeTruthy();
  });

  it('buttons are links to OAuth endpoints', () => {
    render(<SocialButtons providers={['google']} />);
    const link = screen.getByText('Continue with Google').closest('a');
    expect(link?.getAttribute('href')).toBe('/api/auth/oauth/google');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/features/auth/__tests__/SocialButtons.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```
git add src/features/auth/__tests__/SocialButtons.test.tsx
git commit -m "test: add social button component tests"
```

---

## Task 12: Server tests — OAuth route-level tests

**Files:**
- Modify: `server/src/__tests__/oauth.test.ts`

- [ ] **Step 1: Add route-level tests**

Append to the existing `server/src/__tests__/oauth.test.ts`:

```typescript
import request from 'supertest';

describe('OAuth routes', () => {
  it('GET /api/auth/status includes oauthProviders', async () => {
    const res = await request(app).get('/api/auth/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('oauthProviders');
    expect(Array.isArray(res.body.oauthProviders)).toBe(true);
  });

  it('GET /api/auth/oauth/google returns 400 when not configured', async () => {
    const res = await request(app).get('/api/auth/oauth/google');
    expect(res.status).toBe(400);
  });

  it('GET /api/auth/oauth/apple returns 400 when not configured', async () => {
    const res = await request(app).get('/api/auth/oauth/apple');
    expect(res.status).toBe(400);
  });

  it('GET /api/auth/oauth/links requires auth', async () => {
    const res = await request(app).get('/api/auth/oauth/links');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/oauth/links returns empty for new user', async () => {
    const { token } = await createTestUser(app);
    const res = await request(app)
      .get('/api/auth/oauth/links')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('DELETE /api/auth/oauth/link/:provider requires auth', async () => {
    const res = await request(app).delete('/api/auth/oauth/link/google');
    expect(res.status).toBe(401);
  });

  it('DELETE /api/auth/oauth/link/:provider returns 404 for unlinked provider', async () => {
    const { token } = await createTestUser(app);
    const res = await request(app)
      .delete('/api/auth/oauth/link/google')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('login returns hint for social-only user', async () => {
    const { user } = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: `no-password-test-${Date.now()}`,
      email: `nopass${Date.now()}@example.com`,
      displayName: 'No Pass',
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: user.username, password: 'anything' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('NO_PASSWORD');
  });

  it('GET /api/auth/me includes hasPassword', async () => {
    const { token } = await createTestUser(app);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.hasPassword).toBe(true);
  });
});
```

- [ ] **Step 2: Run all OAuth tests**

Run: `cd server && npx vitest run src/__tests__/oauth.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```
git add server/src/__tests__/oauth.test.ts
git commit -m "test: add OAuth route-level tests"
```

---

## Task 13: Final verification

- [ ] **Step 1: Run full frontend type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run full server type check**

Run: `cd server && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run biome**

Run: `npx biome check .`
Expected: PASS (fix any issues)

- [ ] **Step 4: Run frontend tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 5: Run server tests**

Run: `cd server && npx vitest run`
Expected: PASS

- [ ] **Step 6: Verify build**

Run: `npx vite build`
Expected: PASS

- [ ] **Step 7: Commit any fixes**

If any steps above required fixes, commit them.
