import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../index.js';
import * as planGate from '../lib/planGate.js';
import { createTestLocation, createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('Password Reset', () => {
  async function setupAdminAndMember() {
    const admin = await createTestUser(app);
    const location = await createTestLocation(app, admin.token);
    const member = await createTestUser(app);
    // Join member to location
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ inviteCode: location.invite_code });
    return { admin, member, location };
  }

  describe('POST /api/locations/:id/members/:userId/reset-password', () => {
    it('admin can generate a reset token for a member (self-hosted returns token)', async () => {
      const { admin, member, location } = await setupAdminAndMember();
      const res = await request(app)
        .post(`/api/locations/${location.id}/members/${member.user.id}/reset-password`)
        .set('Authorization', `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      // In self-hosted mode (test default), token is returned in response
      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe('string');
      expect(res.body.expiresAt).toBeDefined();
    });

    it('does not return raw token in cloud mode', async () => {
      const { admin, member, location } = await setupAdminAndMember();
      const spy = vi.spyOn(planGate, 'isSelfHosted').mockReturnValue(false);
      try {
        const res = await request(app)
          .post(`/api/locations/${location.id}/members/${member.user.id}/reset-password`)
          .set('Authorization', `Bearer ${admin.token}`);

        expect(res.status).toBe(200);
        // Token must NOT be in the response body in cloud mode
        expect(res.body.token).toBeUndefined();
        expect(res.body.message).toBeDefined();
      } finally {
        spy.mockRestore();
      }
    });

    it('non-admin cannot generate a reset token', async () => {
      const { member, location, admin } = await setupAdminAndMember();
      const res = await request(app)
        .post(`/api/locations/${location.id}/members/${admin.user.id}/reset-password`)
        .set('Authorization', `Bearer ${member.token}`);

      expect(res.status).toBe(403);
    });

    it('admin cannot reset their own password', async () => {
      const { admin, location } = await setupAdminAndMember();
      const res = await request(app)
        .post(`/api/locations/${location.id}/members/${admin.user.id}/reset-password`)
        .set('Authorization', `Bearer ${admin.token}`);

      expect(res.status).toBe(422);
    });

    it('returns 404 for non-member', async () => {
      const { admin, location } = await setupAdminAndMember();
      const outsider = await createTestUser(app);
      const res = await request(app)
        .post(`/api/locations/${location.id}/members/${outsider.user.id}/reset-password`)
        .set('Authorization', `Bearer ${admin.token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('resets password with valid token', async () => {
      const { admin, member, location } = await setupAdminAndMember();

      // Generate token
      const tokenRes = await request(app)
        .post(`/api/locations/${location.id}/members/${member.user.id}/reset-password`)
        .set('Authorization', `Bearer ${admin.token}`);

      // Use token to reset password
      const newPassword = 'NewSecurePass1!';
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: tokenRes.body.token, newPassword });

      expect(resetRes.status).toBe(200);

      // Login with new password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: member.user.username, password: newPassword });

      expect(loginRes.status).toBe(200);
    });

    it('rejects already-used token', async () => {
      const { admin, member, location } = await setupAdminAndMember();

      const tokenRes = await request(app)
        .post(`/api/locations/${location.id}/members/${member.user.id}/reset-password`)
        .set('Authorization', `Bearer ${admin.token}`);

      // Use it once
      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: tokenRes.body.token, newPassword: 'NewSecurePass1!' });

      // Try again
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: tokenRes.body.token, newPassword: 'AnotherPass1!' });

      expect(res.status).toBe(401);
    });

    it('rejects invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'totally-fake-token', newPassword: 'NewSecurePass1!' });

      expect(res.status).toBe(401);
    });

    it('validates password strength', async () => {
      const { admin, member, location } = await setupAdminAndMember();

      const tokenRes = await request(app)
        .post(`/api/locations/${location.id}/members/${member.user.id}/reset-password`)
        .set('Authorization', `Bearer ${admin.token}`);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: tokenRes.body.token, newPassword: 'weak' });

      expect(res.status).toBe(422);
    });

    it('old password no longer works after reset', async () => {
      const { admin, member, location } = await setupAdminAndMember();

      const tokenRes = await request(app)
        .post(`/api/locations/${location.id}/members/${member.user.id}/reset-password`)
        .set('Authorization', `Bearer ${admin.token}`);

      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: tokenRes.body.token, newPassword: 'NewSecurePass1!' });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: member.user.username, password: member.password });

      expect(loginRes.status).toBe(401);
    });
  });
});
