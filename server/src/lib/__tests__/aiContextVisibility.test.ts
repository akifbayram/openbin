import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestBin, createTestLocation, createTestUser, joinTestLocation } from '../../__tests__/helpers.js';
import { createApp } from '../../index.js';
import { buildCommandContext, buildInventoryContext } from '../aiContext.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('AI context visibility — private bins must not leak across users', () => {
  it("omits another user's private bin from buildInventoryContext", async () => {
    const owner = await createTestUser(app);
    const loc = await createTestLocation(app, owner.token);
    const peer = await createTestUser(app);
    await joinTestLocation(app, peer.token, loc.invite_code);

    await createTestBin(app, owner.token, loc.id, {
      name: 'Owners Private Stash',
      visibility: 'private',
      items: ['confidential paperwork'],
    });
    await createTestBin(app, owner.token, loc.id, { name: 'Shared Garage' });

    const peerCtx = await buildInventoryContext(loc.id, peer.user.id);
    const peerBinNames = peerCtx.bins.map((b) => b.name);
    expect(peerBinNames).toContain('Shared Garage');
    expect(peerBinNames).not.toContain('Owners Private Stash');
    expect(peerCtx.other_bins ?? []).toEqual([]);
  });

  it('still shows the owner their own private bin', async () => {
    const owner = await createTestUser(app);
    const loc = await createTestLocation(app, owner.token);
    await createTestBin(app, owner.token, loc.id, { name: 'Owners Private Stash', visibility: 'private' });
    await createTestBin(app, owner.token, loc.id, { name: 'Shared Garage' });

    const ownerCtx = await buildInventoryContext(loc.id, owner.user.id);
    const ownerBinNames = ownerCtx.bins.map((b) => b.name);
    expect(ownerBinNames).toContain('Shared Garage');
    expect(ownerBinNames).toContain('Owners Private Stash');
  });

  it('omits private bins from buildCommandContext for non-owners', async () => {
    const owner = await createTestUser(app);
    const loc = await createTestLocation(app, owner.token);
    const peer = await createTestUser(app);
    await joinTestLocation(app, peer.token, loc.invite_code);

    await createTestBin(app, owner.token, loc.id, { name: 'Owners Private Stash', visibility: 'private' });
    await createTestBin(app, owner.token, loc.id, { name: 'Shared Garage' });

    const peerCtx = await buildCommandContext(loc.id, peer.user.id);
    const peerBinNames = peerCtx.bins.map((b) => b.name);
    expect(peerBinNames).toContain('Shared Garage');
    expect(peerBinNames).not.toContain('Owners Private Stash');
  });

  it("private trashed bins do not leak into another user's trash list", async () => {
    const owner = await createTestUser(app);
    const loc = await createTestLocation(app, owner.token);
    const peer = await createTestUser(app);
    await joinTestLocation(app, peer.token, loc.invite_code);

    const privateBin = await createTestBin(app, owner.token, loc.id, {
      name: 'Owners Private Stash',
      visibility: 'private',
    });
    const sharedBin = await createTestBin(app, owner.token, loc.id, { name: 'Shared Garage' });

    await request(app).delete(`/api/bins/${privateBin.id}`).set('Authorization', `Bearer ${owner.token}`);
    await request(app).delete(`/api/bins/${sharedBin.id}`).set('Authorization', `Bearer ${owner.token}`);

    const peerCtx = await buildInventoryContext(loc.id, peer.user.id);
    const peerTrashNames = peerCtx.trash_bins.map((b) => b.name);
    expect(peerTrashNames).toContain('Shared Garage');
    expect(peerTrashNames).not.toContain('Owners Private Stash');
  });
});
