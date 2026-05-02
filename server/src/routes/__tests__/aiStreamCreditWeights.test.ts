import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// AI_MOCK skips the upstream provider call so streaming routes return a
// short mock SSE payload instead of hanging on network. vi.hoisted runs
// BEFORE the import statements so config.ts (which reads env at module
// load) sees aiMock=true.
vi.hoisted(() => { process.env.AI_MOCK = 'true'; });

type CheckCall = { userId: string; weight: number };
const checkCalls: CheckCall[] = [];

vi.mock('../../lib/planGate.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/planGate.js')>('../../lib/planGate.js');
  return {
    ...actual,
    checkAndIncrementAiCredits: (userId: string, weight: number) => {
      checkCalls.push({ userId, weight });
      return Promise.resolve({ allowed: true, used: 0, limit: 100, resetsAt: null });
    },
    refundAiCredit: () => Promise.resolve(),
  };
});

import { createTestLocation, createTestUser } from '../../__tests__/helpers.js';
import { createApp } from '../../index.js';

let app: Express;
let token: string;
let locationId: string;

describe('AI stream routes — weighted credit charges', () => {
  beforeEach(async () => {
    checkCalls.length = 0;
    app = createApp();
    const user = await createTestUser(app);
    token = user.token;
    const loc = await createTestLocation(app, token);
    locationId = loc.id;
  });

  describe('quickText routes charge 1 credit', () => {
    it('POST /api/ai/ask/stream debits weight=1', async () => {
      await request(app)
        .post('/api/ai/ask/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'where are my batteries', locationId });
      expect(checkCalls.at(-1)?.weight).toBe(1);
    });

    it('POST /api/ai/structure-text/stream debits weight=1', async () => {
      await request(app)
        .post('/api/ai/structure-text/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'milk eggs bread' });
      expect(checkCalls.at(-1)?.weight).toBe(1);
    });

    it('POST /api/ai/query/stream debits weight=1', async () => {
      await request(app)
        .post('/api/ai/query/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ question: 'where are my keys', locationId });
      expect(checkCalls.at(-1)?.weight).toBe(1);
    });

    it('POST /api/ai/command/stream debits weight=1', async () => {
      await request(app)
        .post('/api/ai/command/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'create a new bin called Hardware', locationId });
      expect(checkCalls.at(-1)?.weight).toBe(1);
    });

    it('POST /api/ai/correct/stream debits weight=1', async () => {
      await request(app)
        .post('/api/ai/correct/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ correction: 'Add cables', previousResult: { name: 'box', items: [] }, locationId });
      expect(checkCalls.at(-1)?.weight).toBe(1);
    });
  });

  describe('vision routes charge 5 credits per image', () => {
    it('POST /api/ai/analyze/stream with 1 photoId debits weight=5', async () => {
      await request(app)
        .post('/api/ai/analyze/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ photoId: 'photo-uuid-aaa' });
      expect(checkCalls.at(-1)?.weight).toBe(5);
    });

    it('POST /api/ai/analyze/stream with 3 photoIds debits weight=15', async () => {
      await request(app)
        .post('/api/ai/analyze/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ photoIds: ['p1', 'p2', 'p3'] });
      expect(checkCalls.at(-1)?.weight).toBe(15);
    });

    it('POST /api/ai/reanalyze/stream with 2 photoIds debits weight=10', async () => {
      await request(app)
        .post('/api/ai/reanalyze/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ photoIds: ['p1', 'p2'], previousResult: { name: 'box', items: [] } });
      expect(checkCalls.at(-1)?.weight).toBe(10);
    });
  });

  describe('reorganize routes charge 2 credits per bin', () => {
    it('POST /api/ai/reorganize/stream with 7 bins debits weight=14', async () => {
      const bins = Array.from({ length: 7 }, (_, i) => ({ id: `b${i}`, name: `Bin ${i}`, items: [] }));
      await request(app)
        .post('/api/ai/reorganize/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ bins, locationId });
      expect(checkCalls.at(-1)?.weight).toBe(14);
    });

    it('POST /api/ai/reorganize-tags/stream with 30 bins debits weight=60', async () => {
      const bins = Array.from({ length: 30 }, (_, i) => ({ id: `b${i}`, name: `Bin ${i}`, items: [], tags: [] }));
      await request(app)
        .post('/api/ai/reorganize-tags/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ bins, locationId, changeLevel: 'additive', granularity: 'medium' });
      expect(checkCalls.at(-1)?.weight).toBe(60);
    });
  });
});
