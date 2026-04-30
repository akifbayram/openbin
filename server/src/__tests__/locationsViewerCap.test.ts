import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/planGate.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/planGate.js')>();
  return {
    ...actual,
    getFeatureMap: vi.fn(),
  };
});

import { createApp } from '../index.js';
import { getFeatureMap, type PlanFeatures } from '../lib/planGate.js';
import { createTestLocation, createTestUser } from './helpers.js';

const FREE_FEATURES: PlanFeatures = {
  ai: true,
  apiKeys: false,
  customFields: false,
  fullExport: false,
  reorganize: false,
  binSharing: false,
  attachments: false,
  maxBins: 10,
  maxLocations: 1,
  maxPhotoStorageMb: 0,
  maxMembersPerLocation: 1,
  activityRetentionDays: 7,
  aiCreditsPerMonth: 10,
  reorganizeMaxBins: null,
};

let app: Express;

beforeEach(() => {
  vi.mocked(getFeatureMap).mockImplementation(() => FREE_FEATURES);
  app = createApp();
});

describe('POST /api/locations/join — viewer cap behavior', () => {
  it('allows viewer joins beyond the member cap (free admin)', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    await request(app)
      .put(`/api/locations/${location.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ default_join_role: 'viewer' });

    for (let i = 0; i < 3; i++) {
      const { token: viewerToken } = await createTestUser(app);
      const res = await request(app)
        .post('/api/locations/join')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ inviteCode: location.invite_code });
      expect(res.status).toBe(201);
      expect(res.body.role).toBe('viewer');
    }
  });

  it('blocks member joins beyond the member cap (free admin)', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    const { token: memberToken } = await createTestUser(app);
    const res = await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PLAN_RESTRICTED');
  });
});

describe('PUT /api/locations/:id/members/:userId/role — viewer promotion', () => {
  it('blocks viewer→member promotion when at cap', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    await request(app)
      .put(`/api/locations/${location.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ default_join_role: 'viewer' });
    const { token: viewerToken, user: viewerUser } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ inviteCode: location.invite_code });

    // Free cap = 1, admin already consumes it. Promoting viewer to member should fail.
    const res = await request(app)
      .put(`/api/locations/${location.id}/members/${viewerUser.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'member' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PLAN_RESTRICTED');
  });

  it('allows member→viewer demotion regardless of cap', async () => {
    // Temporarily raise cap so a member can join; then drop it back to 1 before
    // demoting, to prove demotion is not gated by the cap.
    vi.mocked(getFeatureMap).mockImplementationOnce(() => ({ ...FREE_FEATURES, maxMembersPerLocation: 2 }));
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    vi.mocked(getFeatureMap).mockImplementation(() => ({ ...FREE_FEATURES, maxMembersPerLocation: 2 }));
    const { token: memberToken, user: memberUser } = await createTestUser(app);
    const joinRes = await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });
    expect(joinRes.status).toBe(201);

    // Tighten the cap before the demotion to confirm demotion is unaffected.
    vi.mocked(getFeatureMap).mockImplementation(() => FREE_FEATURES);
    const res = await request(app)
      .put(`/api/locations/${location.id}/members/${memberUser.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'viewer' });
    expect(res.status).toBe(200);
  });
});
