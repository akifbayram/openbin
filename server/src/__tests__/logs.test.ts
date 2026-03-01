import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { pushLog } from '../lib/logBuffer.js';
import { createTestLocation, createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('GET /api/admin/logs', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/admin/logs');
    expect(res.status).toBe(401);
  });

  it('requires admin role', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);

    const { token: memberToken } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });

    const res = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  it('returns log entries for admin', async () => {
    const { token } = await createTestUser(app);
    await createTestLocation(app, token);

    pushLog({ level: 'info', message: 'test-entry' });

    const res = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toBeInstanceOf(Array);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    const testEntry = res.body.results.find(
      (e: { message?: string }) => e.message === 'test-entry',
    );
    expect(testEntry).toBeDefined();
  });

  it('supports since parameter', async () => {
    const { token } = await createTestUser(app);
    await createTestLocation(app, token);

    pushLog({ level: 'info', message: 'first' });
    pushLog({ level: 'info', message: 'second' });

    const allRes = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${token}`);

    const entries = allRes.body.results;
    const firstEntry = entries.find((e: { message?: string }) => e.message === 'first');

    const res = await request(app)
      .get(`/api/admin/logs?since=${firstEntry.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const hasFirst = res.body.results.some(
      (e: { message?: string }) => e.message === 'first',
    );
    expect(hasFirst).toBe(false);
  });
});

describe('GET /api/admin/logs/stream', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/admin/logs/stream');
    expect(res.status).toBe(401);
  });

  it('requires admin role', async () => {
    const { token: adminToken } = await createTestUser(app);
    const location = await createTestLocation(app, adminToken);

    const { token: memberToken } = await createTestUser(app);
    await request(app)
      .post('/api/locations/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: location.invite_code });

    const res = await request(app)
      .get('/api/admin/logs/stream')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });
});
