import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/planGate.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/planGate.js')>();
  return {
    ...actual,
    getFeatureMap: vi.fn(),
    isSelfHosted: vi.fn(),
  };
});

import { createApp } from '../index.js';
import { getFeatureMap, isSelfHosted, type PlanFeatures } from '../lib/planGate.js';
import { createTestLocation, createTestUser, joinTestLocation } from './helpers.js';

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
  vi.mocked(isSelfHosted).mockReturnValue(false);
  app = createApp();
});

describe('Free family viewer flow', () => {
  it('allows unlimited viewers but blocks member promotion at cap', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);

    // Admin sets viewer-default
    await request(app)
      .put(`/api/locations/${location.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ default_join_role: 'viewer' });

    // 5 family members join as viewers — all succeed even though Free cap = 1 member
    const viewerUsers: Array<{ id: string; token: string }> = [];
    for (let i = 0; i < 5; i++) {
      const { token, user } = await createTestUser(app);
      await joinTestLocation(app, token, location.invite_code);
      viewerUsers.push({ id: user.id, token });
    }

    // List members — confirm 6 total (admin + 5 viewers), 5 viewers
    const listRes = await request(app)
      .get(`/api/locations/${location.id}/members`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.results).toHaveLength(6);
    expect(listRes.body.results.filter((m: { role: string }) => m.role === 'viewer')).toHaveLength(5);

    // Promoting any viewer to member must fail (Free cap = 1, admin already consumes it)
    const promoteRes = await request(app)
      .put(`/api/locations/${location.id}/members/${viewerUsers[0].id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'member' });
    expect(promoteRes.status).toBe(403);
    expect(promoteRes.body.error).toBe('PLAN_RESTRICTED');

    // Viewer cannot create a bin
    const createRes = await request(app)
      .post('/api/bins')
      .set('Authorization', `Bearer ${viewerUsers[0].token}`)
      .send({ locationId: location.id, name: 'Sneaky Bin' });
    expect(createRes.status).toBe(403);

    // Viewer cannot use AI ask/stream
    const aiRes = await request(app)
      .post('/api/ai/ask/stream')
      .set('Authorization', `Bearer ${viewerUsers[0].token}`)
      .send({ text: 'where is the screwdriver?', locationId: location.id });
    expect(aiRes.status).toBe(403);

    // Viewer CAN read bins
    const adminBinsRes = await request(app)
      .get(`/api/bins?location_id=${location.id}`)
      .set('Authorization', `Bearer ${viewerUsers[0].token}`);
    expect(adminBinsRes.status).toBe(200);

    // Owner-side over-limit check should NOT flag this location for member overage
    const usageRes = await request(app)
      .get('/api/plan/usage')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(usageRes.status).toBe(200);
    expect(usageRes.body.overLimits.members).not.toContain(location.id);
  });
});
