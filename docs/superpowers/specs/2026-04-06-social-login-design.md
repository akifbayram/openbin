# Social Login (Google & Apple) — Design Spec

**Date:** 2026-04-06
**Scope:** Cloud deployment only (`SELF_HOSTED=false`)
**Approach:** Direct OAuth2/OIDC — no auth libraries, no managed services

## Summary

Add "Continue with Google" and "Continue with Apple" to the login and registration flows on `cloud.openbin.app`. Social and password auth coexist on the same account. Accounts auto-link by verified email. Social-only users can set a password later. Existing users can link/unlink social providers from account settings.

## Decisions

- **Cloud only** — self-hosted deployments will not see social login buttons. OAuth credentials are managed centrally.
- **Standard coexistence model** — a single account can have a password + any number of OAuth links. Auto-link by verified email when a social login matches an existing account.
- **Same plan/trial** — social signups get Plus plan with 7-day trial, identical to password signups.
- **Username auto-generation** — derived from email prefix (e.g., `jane` from `jane@gmail.com`), numeric suffix on conflict (`jane2`). User can change later in settings.
- **Apple email privacy** — request real email; accept relay address as fallback.
- **No new dependencies** — `jose` (already installed) handles JWKS verification and Apple client secret JWT signing. HTTP calls via Node built-in `fetch`.

## Database Schema

### New table: `user_oauth_links`

```sql
CREATE TABLE user_oauth_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,          -- 'google' | 'apple'
  provider_user_id TEXT NOT NULL,  -- sub claim from ID token
  email TEXT,                      -- email from provider
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_oauth_provider_user ON user_oauth_links(provider, provider_user_id);
CREATE INDEX idx_oauth_user_id ON user_oauth_links(user_id);
```

### Change to `users` table

- `password_hash` becomes nullable (social-only users won't have one at registration time).

## Environment Variables (cloud only)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `APPLE_CLIENT_ID` | Apple Services ID |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `APPLE_KEY_ID` | Apple Sign In key ID |
| `APPLE_PRIVATE_KEY` | Apple Sign In private key (PEM) |

All optional. Social login buttons only appear when the corresponding env vars are set.

## Server Routes

All routes under `server/src/routes/auth.ts`.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/oauth/google` | GET | Generate Google auth URL (state + PKCE), redirect to Google |
| `/api/auth/oauth/google/callback` | GET | Exchange code, verify ID token, login or create user |
| `/api/auth/oauth/apple` | GET | Generate Apple auth URL (state + nonce), redirect to Apple |
| `/api/auth/oauth/apple/callback` | POST | Apple POSTs back — exchange code, verify ID token |
| `/api/auth/oauth/links` | GET | List linked providers for current user (authenticated) |
| `/api/auth/oauth/link/:provider` | POST | Start linking flow for logged-in user (authenticated) |
| `/api/auth/oauth/link/:provider` | DELETE | Unlink a provider (authenticated, with protection) |

## OAuth Flow (Google)

1. Client clicks "Continue with Google" → navigates to `GET /api/auth/oauth/google`
2. Server generates `state` (random, stored in httpOnly cookie, 10-min expiry) + PKCE `code_verifier` (also in httpOnly cookie)
3. Server redirects to Google's authorization endpoint with `code_challenge`
4. User consents → Google redirects to callback with `code` + `state`
5. Server validates `state` against cookie, exchanges `code` for tokens using `code_verifier`
6. Server verifies ID token signature against Google's JWKS, checks `email_verified === true`
7. Lookup `user_oauth_links` by `(google, sub)`:
   - **Found:** Log in that user — issue access + refresh tokens
   - **Not found, email matches existing user:** Create link, log in existing user
   - **Not found, no email match:** Create new user (auto-generate username, use display name from Google), create link, issue tokens
8. Set token cookies, redirect to `/?oauth=success`

## OAuth Flow (Apple)

Same structure as Google with these differences:

- Callback is `POST` (Apple requirement)
- Client secret is a short-lived JWT signed with Apple's private key using `jose`, regenerated per request
- `nonce` replaces PKCE — generated server-side, hashed and sent in auth URL, validated in returned ID token
- Apple may only send email/name on the first authorization — store them on first link creation

## Shared Helper: `server/src/lib/oauth.ts`

Shared logic extracted into a helper module:

- `generateState()` / `validateState()` — random state + cookie management
- `generatePkce()` — code verifier + challenge for Google
- `generateNonce()` — for Apple
- `findOrCreateOAuthUser(provider, providerUserId, email, displayName)` — the core linking/creation logic
- `generateUsername(email)` — extract prefix before `@`, strip non-alphanumeric/underscore chars, truncate to 50 chars, resolve conflicts with numeric suffix (`jane`, `jane2`, `jane3`…)
- `fetchGoogleJwks()` / `fetchAppleJwks()` — cached JWKS fetching, refreshed on key rotation
- `generateAppleClientSecret()` — short-lived JWT signed with Apple private key

## Client-Side Changes

### Login & Register Pages

- Add "Continue with Google" and "Continue with Apple" buttons above the existing form
- Separated by an "or" divider
- Buttons are plain links to `GET /api/auth/oauth/google` and `GET /api/auth/oauth/apple` — no client-side OAuth SDK needed
- Only rendered when the `/api/auth/status` response includes the provider in `oauthProviders`

### OAuth Return Handling

- After successful OAuth callback, server redirects to `/?oauth=success` (or `/?oauth=error&reason=...`)
- A small handler in the app reads the query param, clears it from the URL, and calls `refreshSession()` to load the user (tokens are already in cookies)
- On error, display a toast with the reason

### Account Settings — Connected Accounts

- New section in `AccountSection.tsx`: "Connected Accounts"
- Shows linked providers with "Disconnect" button
- "Disconnect" disabled (with tooltip) if no password set and only one link remaining
- "Connect Google" / "Connect Apple" buttons for unlinked providers
- "Set password" prompt for social-only users who haven't set one yet

### Auth Status Endpoint Change

- `GET /api/auth/status` response gains `oauthProviders: string[]`
- Populated based on which OAuth env vars are configured
- Empty array when `SELF_HOSTED=true`

## Edge Cases

### Account linking conflicts

- Social login email matches existing password account → auto-link and log in (no duplicate)
- Social login email matches account linked to a *different* provider account of the same type → reject: "This email is already associated with another account"
- Linking from settings and the provider account is already linked to a *different* OpenBin user → reject: "This [provider] account is already linked to another account"

### Unlinking protection

- Cannot unlink last provider if no password is set
- Server enforces this check (not just client-side)
- Error: "Set a password before disconnecting your last login method"

### Password optional

- `password_hash` becomes nullable in the `users` table
- Login route: if user has no password hash, return error code `NO_PASSWORD` with message guiding to social login or password setup
- Password reset flow: works for social-only users — effectively becomes "set your first password"

## Security Checklist

Every OAuth callback must verify:

1. `state` matches httpOnly cookie (CSRF protection)
2. PKCE `code_verifier` verification (Google)
3. `nonce` validation in ID token (Apple)
4. ID token signature verification against provider JWKS (cached, refreshed on key rotation)
5. `email_verified === true` required
6. User not suspended/deleted before issuing tokens
7. OAuth cookies (`state`, `code_verifier`, `nonce`) are `httpOnly`, `secure`, `sameSite: lax`, 10-min expiry

## Testing

### Server tests (`server/src/__tests__/oauth.test.ts`)

Mock provider token/JWKS endpoints (no real Google/Apple calls):

- New user creation via OAuth
- Existing user auto-link by email
- Login via existing link
- Duplicate provider link rejection
- Unlink protection (last method, no password)
- Suspended user rejection
- Invalid/expired state
- `email_verified=false` rejection
- Username auto-generation: prefix extraction, conflict resolution

### Client tests

- Login/Register: social buttons render only when `oauthProviders` is non-empty, hidden on self-hosted
- Account settings: linked accounts section shows correct state, disconnect disabled when appropriate
- OAuth return: query param parsed, `refreshSession()` called, error toast shown

### No E2E OAuth tests

Actual OAuth redirects require real provider credentials. Server tests cover callback logic with mocked provider responses.
