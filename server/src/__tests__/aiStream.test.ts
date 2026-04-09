import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestLocation, createTestUser } from './helpers.js';

let app: Express;
beforeEach(() => { app = createApp(); });

describe('AI streaming routes', () => {
  // ── Auth enforcement ──────────────────────────────────────────────
  describe('auth enforcement', () => {
    it('POST /api/ai/query/stream — 401 without auth', async () => {
      const res = await request(app).post('/api/ai/query/stream').send({});
      expect(res.status).toBe(401);
    });

    it('POST /api/ai/command/stream — 401 without auth', async () => {
      const res = await request(app).post('/api/ai/command/stream').send({});
      expect(res.status).toBe(401);
    });
  });

  // ── Input validation ──────────────────────────────────────────────
  describe('input validation', () => {
    let token: string;
    let locationId: string;

    beforeEach(async () => {
      const user = await createTestUser(app);
      token = user.token;
      const loc = await createTestLocation(app, token);
      locationId = loc.id;
    });

    it('POST /api/ai/query/stream — 422 for missing question', async () => {
      const res = await request(app)
        .post('/api/ai/query/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ locationId });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/question/i);
    });

    it('POST /api/ai/command/stream — 422 for missing text', async () => {
      const res = await request(app)
        .post('/api/ai/command/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ locationId });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/text/i);
    });

    it('POST /api/ai/ask/stream — 422 for missing text', async () => {
      const res = await request(app)
        .post('/api/ai/ask/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ locationId });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/text/i);
    });

    it('POST /api/ai/structure-text/stream — 422 for missing text', async () => {
      const res = await request(app)
        .post('/api/ai/structure-text/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/text/i);
    });

    it('POST /api/ai/analyze-image/stream — 422 for no photo file', async () => {
      const res = await request(app)
        .post('/api/ai/analyze-image/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/photo/i);
    });

    it('POST /api/ai/analyze/stream — 422 for missing photoId', async () => {
      const res = await request(app)
        .post('/api/ai/analyze/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/photoId/i);
    });

    it('POST /api/ai/correct/stream — 422 for missing previousResult', async () => {
      const res = await request(app)
        .post('/api/ai/correct/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ correction: 'fix it' });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/previousResult/i);
    });

    it('POST /api/ai/correct/stream — 422 for invalid previousResult (missing name)', async () => {
      const res = await request(app)
        .post('/api/ai/correct/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ previousResult: { items: [] }, correction: 'fix it' });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/previousResult/i);
    });

    it('POST /api/ai/correct/stream — 422 for invalid previousResult (missing items)', async () => {
      const res = await request(app)
        .post('/api/ai/correct/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ previousResult: { name: 'Bin' }, correction: 'fix it' });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/previousResult/i);
    });

    it('POST /api/ai/correct/stream — 422 for missing correction', async () => {
      const res = await request(app)
        .post('/api/ai/correct/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ previousResult: { name: 'Bin', items: ['item1'] } });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/correction/i);
    });

    it('POST /api/ai/reanalyze-image/stream — 422 for no photo file', async () => {
      const res = await request(app)
        .post('/api/ai/reanalyze-image/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/photo/i);
    });

    it('POST /api/ai/reorganize/stream — 422 for missing bins array', async () => {
      const res = await request(app)
        .post('/api/ai/reorganize/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ locationId });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/bins/i);
    });

    it('POST /api/ai/reorganize/stream — 422 for empty bins array', async () => {
      const res = await request(app)
        .post('/api/ai/reorganize/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ locationId, bins: [] });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/bins/i);
    });

    it('POST /api/ai/reorganize/stream — 422 for invalid maxBins', async () => {
      const res = await request(app)
        .post('/api/ai/reorganize/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ locationId, bins: [{ name: 'A', items: ['x'] }], maxBins: -1 });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/maxBins/i);
    });
  });

  // ── Location membership ───────────────────────────────────────────
  describe('location membership', () => {
    let userToken: string;
    let otherLocationId: string;

    beforeEach(async () => {
      const user = await createTestUser(app);
      userToken = user.token;

      // Create a location with a different user
      const otherUser = await createTestUser(app);
      const otherLoc = await createTestLocation(app, otherUser.token, 'Other Location');
      otherLocationId = otherLoc.id;
    });

    it('POST /api/ai/query/stream — 403 for non-member location', async () => {
      const res = await request(app)
        .post('/api/ai/query/stream')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ locationId: otherLocationId, question: 'what is in bin 1?' });
      expect(res.status).toBe(403);
    });

    it('POST /api/ai/reorganize/stream — 403 for non-member location', async () => {
      const res = await request(app)
        .post('/api/ai/reorganize/stream')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ locationId: otherLocationId, bins: [{ name: 'A', items: ['x'] }] });
      expect(res.status).toBe(403);
    });
  });
});
