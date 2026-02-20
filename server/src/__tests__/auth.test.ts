import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../index.js';
import { createTestUser, createTestLocation } from './helpers.js';

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
      .send({ username: 'newuser', password: 'StrongPass1!' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('newuser');
    expect(res.body.user.id).toBeDefined();
  });

  it('sets httpOnly cookies on register', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'cookieuser', password: 'StrongPass1!' });

    expect(res.status).toBe(201);
    expect(getAccessCookie(res)).toBeDefined();
    expect(getRefreshCookie(res)).toBeDefined();
  });

  it('lowercases the username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'MixedCase', password: 'StrongPass1!' });

    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('mixedcase');
  });

  it('returns 409 for duplicate username', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'duplicate', password: 'StrongPass1!' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'duplicate', password: 'StrongPass1!' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CONFLICT');
  });

  it('returns 422 for weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'weakpw', password: '123' });

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
      .send({ username: 'withname', password: 'StrongPass1!', displayName: 'My Name' });

    expect(res.status).toBe(201);
    expect(res.body.user.displayName).toBe('My Name');
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'logintest', password: 'StrongPass1!' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'logintest', password: 'StrongPass1!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('logintest');
  });

  it('sets httpOnly cookies on login', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'cookielogin', password: 'StrongPass1!' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'cookielogin', password: 'StrongPass1!' });

    expect(res.status).toBe(200);
    expect(getAccessCookie(res)).toBeDefined();
    expect(getRefreshCookie(res)).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'wrongpw', password: 'StrongPass1!' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'wrongpw', password: 'WrongPass1!' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('returns 401 for non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'StrongPass1!' });

    expect(res.status).toBe(401);
  });

  it('returns 422 for missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(422);
  });

  it('returns activeLocationId when user has a location', async () => {
    const { token } = await createTestUser(app);
    await createTestLocation(app, token, 'My Location');

    // Login again to check activeLocationId
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).body.username, password: 'TestPass123!' });

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
    expect(res.body.username).toBeDefined();
  });

  it('authenticates via access cookie', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'cookieme', password: 'StrongPass1!' });

    const accessCookie = getAccessCookie(regRes);
    expect(accessCookie).toBeDefined();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `openbin-access=${accessCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('cookieme');
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
      .send({ username: 'refreshuser', password: 'StrongPass1!' });

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
      .send({ username: 'replayuser', password: 'StrongPass1!' });

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
      .send({ username: 'logoutuser', password: 'StrongPass1!' });

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
      .send({ username: 'logoutall', password: 'StrongPass1!' });

    const token = regRes.body.token;

    // Login again to create a second refresh token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'logoutall', password: 'StrongPass1!' });

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
      .send({ username: 'pwchangeuser', password: 'StrongPass1!' });

    const token = regRes.body.token;
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
      .send({ username: 'pwchangeuser', password: 'NewStrongPass1!' });

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
