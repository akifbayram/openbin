import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { query } from '../db.js';
import { createApp } from '../index.js';
import { findOrCreateOAuthUser } from '../lib/oauth.js';
import { signToken } from '../middleware/auth.js';
import { createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('findOrCreateOAuthUser', () => {
  it('creates new user when no match exists', async () => {
    const result = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-123',
      email: 'newuser@example.com',
      displayName: 'New User',
    });
    expect(result.user.email).toBe('newuser@example.com');
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

  it('throws ForbiddenError when email matches existing password user', async () => {
    await createTestUser(app, { email: 'link@example.com' });
    await expect(
      findOrCreateOAuthUser({
        provider: 'google',
        providerUserId: 'google-sub-789',
        email: 'link@example.com',
        displayName: 'Linked',
      })
    ).rejects.toThrow('An account with this email already exists');
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

  it('login returns generic credentials error for social-only user (no enumeration)', async () => {
    const { user } = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: `no-password-test-${Date.now()}`,
      email: `nopass${Date.now()}@example.com`,
      displayName: 'No Pass',
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'anything' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
    expect(res.body.message).toBe('Invalid email or password');
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
    // Default grace = 30 days → soft-delete with a scheduled hard-delete.
    expect(res.body.message).toBe('Account scheduled for deletion');
    expect(res.body.scheduledAt).toBeTruthy();
    // User row remains during the grace window with deletion fields set.
    const check = await query<{ deleted_at: string | null }>(
      'SELECT deleted_at FROM users WHERE id = $1',
      [user.id],
    );
    expect(check.rows).toHaveLength(1);
    expect(check.rows[0].deleted_at).not.toBeNull();
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
    expect(res.body.message).toBe('Account scheduled for deletion');
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
    // Default grace = 30 days → soft-delete with a scheduled hard-delete.
    expect(res.body.message).toBe('Account scheduled for deletion');
    expect(res.body.scheduledAt).toBeTruthy();
    const check = await query<{ deleted_at: string | null }>(
      'SELECT deleted_at FROM users WHERE id = $1',
      [user.id],
    );
    expect(check.rows).toHaveLength(1);
    expect(check.rows[0].deleted_at).not.toBeNull();
  });
});
