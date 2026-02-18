import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../index.js';
import { createTestUser, createTestLocation } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

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
  it('changes password successfully', async () => {
    const { token, password } = await createTestUser(app);

    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password, newPassword: 'NewStrongPass1!' });

    expect(res.status).toBe(200);

    // Verify new password works
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: me.body.username, password: 'NewStrongPass1!' });

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
