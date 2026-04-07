import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { generateUuid, query } from '../db.js';
import { createApp } from '../index.js';
import { findOrCreateOAuthUser, generateUsername } from '../lib/oauth.js';
import { signToken } from '../middleware/auth.js';
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
    const long = `${'a'.repeat(60)}@example.com`;
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

describe('OAuth routes', () => {
  it('GET /api/auth/status includes oauthProviders', async () => {
    const res = await request(app).get('/api/auth/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('oauthProviders');
    expect(Array.isArray(res.body.oauthProviders)).toBe(true);
  });

  it('GET /api/auth/oauth/google returns 422 when not configured', async () => {
    const res = await request(app).get('/api/auth/oauth/google');
    expect(res.status).toBe(422);
  });

  it('GET /api/auth/oauth/apple returns 422 when not configured', async () => {
    const res = await request(app).get('/api/auth/oauth/apple');
    expect(res.status).toBe(422);
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
    expect(res.body.hasPassword).toBe(true);
  });

  it('OAuth-only user can delete account without password', async () => {
    const { user } = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: `delete-oauth-${Date.now()}`,
      email: `deleteoauth${Date.now()}@example.com`,
      displayName: 'Delete OAuth',
    });
    const token = await signToken(user);
    const res = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Account deleted');
    // Verify user is gone
    const check = await query('SELECT id FROM users WHERE id = $1', [user.id]);
    expect(check.rows).toHaveLength(0);
  });

  it('OAuth-only user can delete account with no request body', async () => {
    const { user } = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: `delete-nobody-${Date.now()}`,
      email: `deletenobody${Date.now()}@example.com`,
      displayName: 'Delete No Body',
    });
    const token = await signToken(user);
    // No .send() — matches real client behavior when apiFetch sends body: undefined
    const res = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Account deleted');
  });

  it('OAuth-only user hasPassword is false on /me', async () => {
    const { user } = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: `me-oauth-${Date.now()}`,
      email: `meoauth${Date.now()}@example.com`,
      displayName: 'Me OAuth',
    });
    const token = await signToken(user);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.hasPassword).toBe(false);
  });

  it('password user cannot delete account without password', async () => {
    const { token } = await createTestUser(app);
    const res = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('password user cannot delete account with wrong password', async () => {
    const { token } = await createTestUser(app);
    const res = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'WrongPassword123!' });
    expect(res.status).toBe(401);
  });

  it('password user can delete account with correct password', async () => {
    const { token, password, user } = await createTestUser(app);
    const res = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Account deleted');
    const check = await query('SELECT id FROM users WHERE id = $1', [user.id]);
    expect(check.rows).toHaveLength(0);
  });
});
