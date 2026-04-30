import type { Express } from 'express';
import { Router } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMemberOrAbove } from '../middleware/locationAccess.js';
import { createTestLocation, createTestUser, joinTestLocation } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp({
    mountEeRoutes: (a) => {
      const probe = Router();
      probe.use(authenticate);
      probe.get('/:id/probe', requireLocationMemberOrAbove(), (_req, res) => {
        res.json({ ok: true });
      });
      a.use('/api/_test_locations', probe);
    },
  });
});

describe('requireLocationMemberOrAbove', () => {
  it('allows admins through', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const res = await request(app)
      .get(`/api/_test_locations/${location.id}/probe`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('allows members through', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    const { token: memberToken } = await createTestUser(app);
    await joinTestLocation(app, memberToken, location.invite_code);
    const res = await request(app)
      .get(`/api/_test_locations/${location.id}/probe`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
  });

  it('blocks viewers with 403', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    await request(app)
      .put(`/api/locations/${location.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ default_join_role: 'viewer' });
    const { token: viewerToken } = await createTestUser(app);
    await joinTestLocation(app, viewerToken, location.invite_code);
    const res = await request(app)
      .get(`/api/_test_locations/${location.id}/probe`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('blocks non-members with 403', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    const { token: outsiderToken } = await createTestUser(app);
    const res = await request(app)
      .get(`/api/_test_locations/${location.id}/probe`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });
});
