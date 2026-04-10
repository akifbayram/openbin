import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestLocation, createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

function parseCookies(res: request.Response): Record<string, string> {
  const cookies: Record<string, string> = {};
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return cookies;
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of arr) {
    const [nameVal] = c.split(';');
    const [name, ...rest] = nameVal.split('=');
    cookies[name.trim()] = rest.join('=');
  }
  return cookies;
}

function getRefreshCookie(res: request.Response): string | undefined {
  return parseCookies(res)['openbin-refresh'];
}

function getAccessCookie(res: request.Response): string | undefined {
  return parseCookies(res)['openbin-access'];
}

describe('POST /api/auth/register', () => {
  it('registers a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'newuser@test.local', password: 'StrongPass1!', displayName: 'New User' });

    expect(res.status).toBe(201);
    expect(getAccessCookie(res)).toBeDefined();
    expect(res.body.user.email).toBe('newuser@test.local');
    expect(res.body.user.id).toBeDefined();
  });

  it('sets httpOnly cookies on register', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'cookieuser@test.local', password: 'StrongPass1!', displayName: 'Cookie User' });

    expect(res.status).toBe(201);
    expect(getAccessCookie(res)).toBeDefined();
    expect(getRefreshCookie(res)).toBeDefined();
  });

  it('lowercases the email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'MixedCase@Test.Local', password: 'StrongPass1!', displayName: 'Mixed Case' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('mixedcase@test.local');
  });

  it('returns 409 for duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'duplicate@test.local', password: 'StrongPass1!', displayName: 'Duplicate' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'duplicate@test.local', password: 'StrongPass1!', displayName: 'Duplicate2' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CONFLICT');
  });

  it('returns 422 for weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'weakpw@test.local', password: '123', displayName: 'Weak' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({});

    expect(res.status).toBe(422);
  });

  it('uses displayName when provided', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'withname@test.local', password: 'StrongPass1!', displayName: 'My Name' });

    expect(res.status).toBe(201);
    expect(res.body.user.displayName).toBe('My Name');
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'logintest@test.local', password: 'StrongPass1!', displayName: 'Login Test' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'logintest@test.local', password: 'StrongPass1!' });

    expect(res.status).toBe(200);
    expect(getAccessCookie(res)).toBeDefined();
    expect(res.body.user.email).toBe('logintest@test.local');
  });

  it('sets httpOnly cookies on login', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'cookielogin@test.local', password: 'StrongPass1!', displayName: 'Cookie Login' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'cookielogin@test.local', password: 'StrongPass1!' });

    expect(res.status).toBe(200);
    expect(getAccessCookie(res)).toBeDefined();
    expect(getRefreshCookie(res)).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'wrongpw@test.local', password: 'StrongPass1!', displayName: 'Wrong PW' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrongpw@test.local', password: 'WrongPass1!' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('returns 401 for non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.local', password: 'StrongPass1!' });

    expect(res.status).toBe(401);
  });

  it('returns 422 for missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(422);
  });

  it('returns activeLocationId when user has a location', async () => {
    const { token, user } = await createTestUser(app);
    await createTestLocation(app, token, 'My Location');

    // Login again to check activeLocationId
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'TestPass123!' });

    expect(res.status).toBe(200);
    expect(res.body.activeLocationId).toBeDefined();
  });
});

describe('GET /api/auth/me', () => {
  it('returns current user with valid token', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.email).toBeDefined();
  });

  it('authenticates via access cookie', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'cookieme@test.local', password: 'StrongPass1!', displayName: 'Cookie Me' });

    const accessCookie = getAccessCookie(regRes);
    expect(accessCookie).toBeDefined();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `openbin-access=${accessCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('cookieme@test.local');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('issues new tokens when refresh cookie is valid', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'refreshuser@test.local', password: 'StrongPass1!', displayName: 'Refresh User' });

    const refreshCookie = getRefreshCookie(regRes);
    expect(refreshCookie).toBeDefined();

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `openbin-refresh=${refreshCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Token refreshed');
    expect(getAccessCookie(res)).toBeDefined();
    expect(getRefreshCookie(res)).toBeDefined();
    // New refresh token should differ from old one
    expect(getRefreshCookie(res)).not.toBe(refreshCookie);
  });

  it('returns 401 when no refresh cookie', async () => {
    const res = await request(app)
      .post('/api/auth/refresh');

    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'openbin-refresh=invalid-token');

    expect(res.status).toBe(401);
  });

  it('detects replay attack and revokes entire family', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'replayuser@test.local', password: 'StrongPass1!', displayName: 'Replay User' });

    const originalRefresh = getRefreshCookie(regRes)!;

    // First rotation — succeeds
    const firstRotation = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `openbin-refresh=${originalRefresh}`);
    expect(firstRotation.status).toBe(200);

    const newRefresh = getRefreshCookie(firstRotation)!;

    // Replay the original token — should fail and revoke family
    const replay = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `openbin-refresh=${originalRefresh}`);
    expect(replay.status).toBe(401);

    // The new token from first rotation should also be revoked now
    const afterReplay = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `openbin-refresh=${newRefresh}`);
    expect(afterReplay.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes refresh token and clears cookies', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'logoutuser@test.local', password: 'StrongPass1!', displayName: 'Logout User' });

    const refreshCookie = getRefreshCookie(regRes)!;

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `openbin-refresh=${refreshCookie}`);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.message).toBe('Logged out');

    // Refresh token should no longer work
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `openbin-refresh=${refreshCookie}`);
    expect(refreshRes.status).toBe(401);
  });

  it('succeeds even without refresh cookie', async () => {
    const res = await request(app)
      .post('/api/auth/logout');

    expect(res.status).toBe(200);
  });
});

describe('POST /api/auth/logout-all', () => {
  it('revokes all refresh tokens for user', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'logoutall@test.local', password: 'StrongPass1!', displayName: 'Logout All' });

    const token = getAccessCookie(regRes)!;

    // Login again to create a second refresh token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'logoutall@test.local', password: 'StrongPass1!' });

    const secondRefresh = getRefreshCookie(loginRes)!;

    // Logout all
    const logoutRes = await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${token}`);

    expect(logoutRes.status).toBe(200);

    // Second session's refresh should be revoked
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `openbin-refresh=${secondRefresh}`);
    expect(refreshRes.status).toBe(401);
  });
});

describe('PUT /api/auth/profile', () => {
  it('updates display name', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('New Name');
  });

  it('updates email', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('test@example.com');
  });

  it('returns 422 with empty body', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});

describe('PUT /api/auth/password', () => {
  it('changes password and revokes all refresh tokens', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'pwchangeuser@test.local', password: 'StrongPass1!', displayName: 'PW Change User' });

    const token = getAccessCookie(regRes)!;
    const refreshCookie = getRefreshCookie(regRes)!;

    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'StrongPass1!', newPassword: 'NewStrongPass1!' });

    expect(res.status).toBe(200);

    // Old refresh token should be revoked
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `openbin-refresh=${refreshCookie}`);
    expect(refreshRes.status).toBe(401);

    // Verify new password works
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pwchangeuser@test.local', password: 'NewStrongPass1!' });

    expect(loginRes.status).toBe(200);
  });

  it('returns 401 for wrong current password', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPass1!', newPassword: 'NewStrongPass1!' });

    expect(res.status).toBe(401);
  });

  it('returns 422 for weak new password', async () => {
    const { token, password } = await createTestUser(app);

    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password, newPassword: '123' });

    expect(res.status).toBe(422);
  });
});

describe('GET /api/auth/status — registration mode', () => {
  it('returns registrationMode', async () => {
    const res = await request(app).get('/api/auth/status');
    expect(res.status).toBe(200);
    expect(res.body.registrationMode).toBe('open');
  });
});

describe('POST /api/auth/register — invite code', () => {
  it('registers and auto-joins location when inviteCode provided', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `inviteuser_${Date.now()}@test.local`,
        password: 'TestPass123!',
        displayName: 'Invite User',
        inviteCode: location.invite_code,
      });

    expect(res.status).toBe(201);

    // Extract access token from cookies to verify location membership
    const accessToken = getAccessCookie(res);
    expect(accessToken).toBeDefined();

    const locRes = await request(app)
      .get('/api/locations')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(locRes.body.count).toBe(1);
    expect(locRes.body.results[0].id).toBe(location.id);
  });

  it('returns 404 for invalid invite code during registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `badinvite_${Date.now()}@test.local`,
        password: 'TestPass123!',
        displayName: 'Bad Invite',
        inviteCode: 'nonexistent-code',
      });

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/auth/active-location', () => {
  it('sets active location', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .put('/api/auth/active-location')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: location.id });

    expect(res.status).toBe(200);
    expect(res.body.activeLocationId).toBe(location.id);
  });

  it('returns 403 for non-member location', async () => {
    const { token } = await createTestUser(app);
    const { token: otherToken } = await createTestUser(app);
    const location = await createTestLocation(app, otherToken);

    const res = await request(app)
      .put('/api/auth/active-location')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: location.id });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/auth/register — plan initialization', () => {
  it('sets plan=PRO and sub_status=ACTIVE for self-hosted mode', async () => {
    // Default test environment is self-hosted (SELF_HOSTED=true by default in config)
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: `plantest_sh_${Date.now()}@test.local`, password: 'StrongPass1!', displayName: 'Plan Test' });
    expect(regRes.status).toBe(201);

    const token = getAccessCookie(regRes);
    expect(token).toBeDefined();

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.plan).toBe('plus');
    expect(meRes.body.subscriptionStatus).toBe('active');
    expect(meRes.body.activeUntil).toBeDefined();

    // active_until should be far in the future (>100 years from now)
    const activeUntil = new Date(meRes.body.activeUntil);
    const hundredYearsFromNow = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
    expect(activeUntil.getTime()).toBeGreaterThan(hundredYearsFromNow.getTime());
  });
});

describe('GET /api/auth/me — plan info', () => {
  it('returns plan, subscriptionStatus, and activeUntil fields', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.plan).toBeDefined();
    expect(['pro', 'plus', 'free']).toContain(res.body.plan);
    expect(res.body.subscriptionStatus).toBeDefined();
    expect(['active', 'trial', 'inactive']).toContain(res.body.subscriptionStatus);
    expect('activeUntil' in res.body).toBe(true);
  });
});

describe('GET /api/auth/status — selfHosted flag', () => {
  it('returns selfHosted field', async () => {
    const res = await request(app).get('/api/auth/status');
    expect(res.status).toBe(200);
    expect('selfHosted' in res.body).toBe(true);
    expect(typeof res.body.selfHosted).toBe('boolean');
  });

  it('selfHosted is true in default test environment', async () => {
    const res = await request(app).get('/api/auth/status');
    expect(res.status).toBe(200);
    // Default config has SELF_HOSTED=true
    expect(res.body.selfHosted).toBe(true);
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('returns 200 for existing email', async () => {
    const { token } = await createTestUser(app);
    // Set an email on the user first
    await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'exists@example.com' });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'exists@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an account/);
  });

  it('returns 200 for unknown email (no info leak)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an account/);
  });

  it('returns 422 for missing email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({});

    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(422);
  });
});

describe('Avatar endpoints', () => {
  it('GET /api/auth/avatar/:userId — 404 when no avatar set', async () => {
    const { token, user } = await createTestUser(app);
    const res = await request(app)
      .get(`/api/auth/avatar/${user.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('DELETE /api/auth/avatar — succeeds even without avatar', async () => {
    const { token } = await createTestUser(app);
    const res = await request(app)
      .delete('/api/auth/avatar')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Avatar removed');
  });

  it('POST /api/auth/avatar — 401 without auth', async () => {
    const res = await request(app)
      .post('/api/auth/avatar')
      .attach('avatar', Buffer.from('fake'), 'test.png');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/invite-preview', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/auth/invite-preview?code=abc123');
    expect(res.status).toBe(401);
  });

  it('returns location info when authenticated with valid code', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .get(`/api/auth/invite-preview?code=${location.invite_code}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe(location.name);
    expect(res.body.memberCount).toBeDefined();
  });
});
