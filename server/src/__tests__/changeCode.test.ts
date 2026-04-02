import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import './setup.js';
import { createApp } from '../index.js';
import { validateCodeFormat } from '../lib/binValidation.js';
import { createTestBin, createTestLocation, createTestUser } from './helpers.js';

describe('validateCodeFormat', () => {
  it('accepts valid 6-char uppercase codes', () => {
    expect(() => validateCodeFormat('ABCDEF')).not.toThrow();
  });

  it('accepts codes with digits', () => {
    expect(() => validateCodeFormat('ABC123')).not.toThrow();
  });

  it('rejects codes shorter than 6 chars', () => {
    expect(() => validateCodeFormat('ABCD')).toThrow('Code must be exactly 6 alphanumeric characters');
  });

  it('rejects codes longer than 6 chars', () => {
    expect(() => validateCodeFormat('ABCDEFG')).toThrow('Code must be exactly 6 alphanumeric characters');
  });

  it('rejects codes with special characters', () => {
    expect(() => validateCodeFormat('ABC-DE')).toThrow('Code must be exactly 6 alphanumeric characters');
  });

  it('rejects empty string', () => {
    expect(() => validateCodeFormat('')).toThrow('Code must be exactly 6 alphanumeric characters');
  });
});

describe('POST /api/bins/:id/change-code', () => {
  let app: Express;
  beforeEach(() => { app = createApp(); });

  it('changes bin code to an unclaimed code', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, loc.id, { name: 'My Bin' });

    const res = await request(app)
      .post(`/api/bins/${bin.id}/change-code`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'ZZZZZZ' });

    expect(res.status).toBe(200);
    // UUID stays the same; only short_code changes
    expect(res.body.id).toBe(bin.id);
    expect(res.body.short_code).toBe('ZZZZZZ');
    expect(res.body.name).toBe('My Bin');

    // Bin is still accessible by its UUID
    const lookup = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(lookup.status).toBe(200);
    expect(lookup.body.short_code).toBe('ZZZZZZ');
  });

  it('rejects code already in use in same location', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const binA = await createTestBin(app, token, loc.id, { name: 'Bin A', items: ['item1'] });
    const binB = await createTestBin(app, token, loc.id, { name: 'Bin B', items: ['item2'] });

    // Try to change Bin A's code to Bin B's short_code
    const res = await request(app)
      .post(`/api/bins/${binA.id}/change-code`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: binB.short_code });

    expect(res.status).toBe(422);
  });

  it('preserves items after code change', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, loc.id, { name: 'Items Bin', items: ['wrench', 'hammer'] });

    const res = await request(app)
      .post(`/api/bins/${bin.id}/change-code`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'TSTXYZ' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(bin.id);
    expect(res.body.short_code).toBe('TSTXYZ');
    const itemNames = res.body.items.map((i: { name: string }) => i.name);
    expect(itemNames).toContain('wrench');
    expect(itemNames).toContain('hammer');
  });

  it('rejects invalid code format', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, loc.id);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/change-code`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'ab' });

    expect(res.status).toBe(422);
  });

  it('rejects same code as current', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, loc.id);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/change-code`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: bin.short_code });

    expect(res.status).toBe(422);
  });

  it('rejects non-admin users', async () => {
    const { token: adminToken } = await createTestUser(app);
    const loc = await createTestLocation(app, adminToken);
    const bin = await createTestBin(app, adminToken, loc.id);

    // Create a member user
    const { token: memberToken } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: loc.invite_code });

    const res = await request(app)
      .post(`/api/bins/${bin.id}/change-code`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ code: 'ZZZZZZ' });

    expect(res.status).toBe(403);
  });

  it('allows same code in different locations', async () => {
    const { token: user1Token } = await createTestUser(app);
    const loc1 = await createTestLocation(app, user1Token);
    const bin1 = await createTestBin(app, user1Token, loc1.id, { name: 'Bin in Loc1' });

    const { token: user2Token } = await createTestUser(app);
    const loc2 = await createTestLocation(app, user2Token);
    const bin2 = await createTestBin(app, user2Token, loc2.id, { name: 'Bin in Loc2' });

    // Change bin1's code to match bin2's short_code (different location = no conflict)
    const res = await request(app)
      .post(`/api/bins/${bin1.id}/change-code`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ code: bin2.short_code });

    expect(res.status).toBe(200);
    expect(res.body.short_code).toBe(bin2.short_code);
  });

  it('returns 404 for non-existent bin', async () => {
    const { token } = await createTestUser(app);
    await createTestLocation(app, token);

    const res = await request(app)
      .post('/api/bins/00000000-0000-0000-0000-000000000000/change-code')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'ZZZZZZ' });

    expect(res.status).toBe(404);
  });
});
