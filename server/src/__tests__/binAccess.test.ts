import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { query } from '../db.js';
import { createApp } from '../index.js';
import { requireMemberOrAbove } from '../lib/binAccess.js';
import { createTestLocation, createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('requireMemberOrAbove', () => {
  it('allows admin', async () => {
    const { token, user } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    await expect(requireMemberOrAbove(location.id, user.id, 'test')).resolves.not.toThrow();
  });

  it('allows member', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    const { token: memberToken, user: memberUser } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });
    await expect(requireMemberOrAbove(location.id, memberUser.id, 'test')).resolves.not.toThrow();
  });

  it('rejects viewer', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    const { token: viewerToken, user: viewerUser } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ inviteCode: location.invite_code });
    await query(
      "UPDATE location_members SET role = 'viewer' WHERE location_id = $1 AND user_id = $2",
      [location.id, viewerUser.id]
    );
    await expect(requireMemberOrAbove(location.id, viewerUser.id, 'create bins')).rejects.toThrow('Only members and admins can create bins');
  });

  it('rejects non-member', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);
    const { user: stranger } = await createTestUser(app);
    await expect(requireMemberOrAbove(location.id, stranger.id, 'test')).rejects.toThrow('Not a member of this location');
  });
});
