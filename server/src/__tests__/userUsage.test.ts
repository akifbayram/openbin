import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { getUserUsage } from '../lib/planGate.js';
import { createTestLocation, createTestUser, joinTestLocation } from './helpers.js';

let app: Express;
beforeEach(() => {
  app = createApp();
});

describe('getUserUsage — viewer accounting', () => {
  it('memberCounts excludes viewers; viewerCounts is populated', async () => {
    const { token, user: owner } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    // Switch to viewer-default and add 2 viewers
    await request(app)
      .put(`/api/locations/${location.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ default_join_role: 'viewer' });
    for (let i = 0; i < 2; i++) {
      const { token: vToken } = await createTestUser(app);
      await joinTestLocation(app, vToken, location.invite_code);
    }

    // Switch back to member-default and add 1 member
    await request(app)
      .put(`/api/locations/${location.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ default_join_role: 'member' });
    const { token: mToken } = await createTestUser(app);
    await joinTestLocation(app, mToken, location.invite_code);

    const usage = await getUserUsage(owner.id);
    // admin (owner) + 1 member
    expect(usage.memberCounts[location.id]).toBe(2);
    expect(usage.viewerCounts[location.id]).toBe(2);
  });

  it('returns empty viewerCounts when no viewers exist', async () => {
    const { token, user: owner } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const usage = await getUserUsage(owner.id);
    expect(usage.memberCounts[location.id]).toBe(1); // admin only
    expect(usage.viewerCounts[location.id]).toBeUndefined();
  });
});
