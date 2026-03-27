import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it, beforeEach } from 'vitest';
import './setup.js';
import { validateCodeFormat } from '../lib/binValidation.js';
import { createApp } from '../index.js';
import { createTestBin, createTestLocation, createTestUser } from './helpers.js';

describe('validateCodeFormat', () => {
  it('accepts valid 6-char uppercase codes', () => {
    expect(() => validateCodeFormat('ABCDEF')).not.toThrow();
  });

  it('accepts 4-char codes', () => {
    expect(() => validateCodeFormat('ABCD')).not.toThrow();
  });

  it('accepts 8-char codes', () => {
    expect(() => validateCodeFormat('ABCD1234')).not.toThrow();
  });

  it('accepts codes with digits', () => {
    expect(() => validateCodeFormat('ABC123')).not.toThrow();
  });

  it('rejects codes shorter than 4 chars', () => {
    expect(() => validateCodeFormat('ABC')).toThrow('Code must be 4-8 alphanumeric characters');
  });

  it('rejects codes longer than 8 chars', () => {
    expect(() => validateCodeFormat('ABCDEFGHI')).toThrow('Code must be 4-8 alphanumeric characters');
  });

  it('rejects codes with special characters', () => {
    expect(() => validateCodeFormat('ABC-DE')).toThrow('Code must be 4-8 alphanumeric characters');
  });

  it('rejects empty string', () => {
    expect(() => validateCodeFormat('')).toThrow('Code must be 4-8 alphanumeric characters');
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
    expect(res.body.id).toBe('ZZZZZZ');
    expect(res.body.name).toBe('My Bin');

    // Old code should be gone
    const old = await request(app)
      .get(`/api/bins/${bin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(old.status).toBe(404);
  });

  it('changes bin code to a claimed code and deletes the old bin', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const binA = await createTestBin(app, token, loc.id, { name: 'Bin A', items: ['item1'] });
    const binB = await createTestBin(app, token, loc.id, { name: 'Bin B', items: ['item2'] });

    // Bin A adopts Bin B's code
    const res = await request(app)
      .post(`/api/bins/${binA.id}/change-code`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: binB.id });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(binB.id);
    expect(res.body.name).toBe('Bin A');

    // binB.id now points to Bin A's data
    const lookup = await request(app)
      .get(`/api/bins/${binB.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(lookup.body.name).toBe('Bin A');
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
      .send({ code: bin.id });

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

  it('rejects cross-location change when user is not admin in other location', async () => {
    const { token: adminToken } = await createTestUser(app);
    const loc1 = await createTestLocation(app, adminToken);
    const bin1 = await createTestBin(app, adminToken, loc1.id, { name: 'Bin in Loc1' });

    // Create a second user who is admin of a different location
    const { token: otherToken } = await createTestUser(app);
    const loc2 = await createTestLocation(app, otherToken);
    const bin2 = await createTestBin(app, otherToken, loc2.id, { name: 'Bin in Loc2' });

    // admin of loc1 tries to adopt a code from loc2 (where they are NOT a member)
    const res = await request(app)
      .post(`/api/bins/${bin1.id}/change-code`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: bin2.id });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent bin', async () => {
    const { token } = await createTestUser(app);
    await createTestLocation(app, token);

    const res = await request(app)
      .post('/api/bins/NOPE99/change-code')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'ZZZZZZ' });

    expect(res.status).toBe(404);
  });
});
