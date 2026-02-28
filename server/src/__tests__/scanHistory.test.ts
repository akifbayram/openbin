import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../index.js';
import { createTestUser, createTestLocation, createTestBin } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('GET /api/scan-history', () => {
  it('returns empty initially', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/scan-history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('respects limit param', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin1 = await createTestBin(app, token, location.id, { name: 'Bin 1' });
    const bin2 = await createTestBin(app, token, location.id, { name: 'Bin 2' });
    const bin3 = await createTestBin(app, token, location.id, { name: 'Bin 3' });

    await request(app)
      .post('/api/scan-history')
      .set('Authorization', `Bearer ${token}`)
      .send({ binId: bin1.id });
    await request(app)
      .post('/api/scan-history')
      .set('Authorization', `Bearer ${token}`)
      .send({ binId: bin2.id });
    await request(app)
      .post('/api/scan-history')
      .set('Authorization', `Bearer ${token}`)
      .send({ binId: bin3.id });

    const res = await request(app)
      .get('/api/scan-history?limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
  });

  it('clamps limit to 100', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/scan-history?limit=999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toBeDefined();
  });
});

describe('POST /api/scan-history', () => {
  it('records scan with 201', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .post('/api/scan-history')
      .set('Authorization', `Bearer ${token}`)
      .send({ binId: bin.id });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('upserts on duplicate binId', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    await request(app)
      .post('/api/scan-history')
      .set('Authorization', `Bearer ${token}`)
      .send({ binId: bin.id });

    await request(app)
      .post('/api/scan-history')
      .set('Authorization', `Bearer ${token}`)
      .send({ binId: bin.id });

    const res = await request(app)
      .get('/api/scan-history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].bin_id).toBe(bin.id);
  });

  it('validates binId', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/scan-history')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/scan-history', () => {
  it('clears with 204', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin1 = await createTestBin(app, token, location.id, { name: 'Bin 1' });
    const bin2 = await createTestBin(app, token, location.id, { name: 'Bin 2' });

    await request(app)
      .post('/api/scan-history')
      .set('Authorization', `Bearer ${token}`)
      .send({ binId: bin1.id });

    await request(app)
      .post('/api/scan-history')
      .set('Authorization', `Bearer ${token}`)
      .send({ binId: bin2.id });

    const delRes = await request(app)
      .delete('/api/scan-history')
      .set('Authorization', `Bearer ${token}`);

    expect(delRes.status).toBe(204);

    const getRes = await request(app)
      .get('/api/scan-history')
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.body.results).toEqual([]);
    expect(getRes.body.count).toBe(0);
  });

  it('user isolation', async () => {
    const { token: tokenA } = await createTestUser(app);
    const locationA = await createTestLocation(app, tokenA, 'Location A');
    const binA = await createTestBin(app, tokenA, locationA.id, { name: 'Bin A' });

    const { token: tokenB } = await createTestUser(app);
    const locationB = await createTestLocation(app, tokenB, 'Location B');
    const binB = await createTestBin(app, tokenB, locationB.id, { name: 'Bin B' });

    // User A records a scan
    await request(app)
      .post('/api/scan-history')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ binId: binA.id });

    // User B records and deletes their own scans
    await request(app)
      .post('/api/scan-history')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ binId: binB.id });

    await request(app)
      .delete('/api/scan-history')
      .set('Authorization', `Bearer ${tokenB}`);

    // User A's scan should still exist
    const resA = await request(app)
      .get('/api/scan-history')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(resA.body.results).toHaveLength(1);
    expect(resA.body.results[0].bin_id).toBe(binA.id);

    // User B's scan should be gone
    const resB = await request(app)
      .get('/api/scan-history')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(resB.body.results).toEqual([]);
  });
});
