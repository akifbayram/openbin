import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/config.js')>();
  return {
    ...original,
    isDemoUser: (req: { user?: { email: string } }) =>
      !!req.user && req.user.email.toLowerCase() === 'demo@openbin.local',
  };
});

import { createApp } from '../index.js';
import { createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('demo user AI key guards', () => {
  describe('GET /api/ai/settings', () => {
    it('demo user sees sk-**** masked keys', async () => {
      const { token, user } = await createTestUser(app, { email: 'demo@openbin.local' });

      // Insert settings directly for the demo user
      const { query: dbQuery } = await import('../db.js');
      dbQuery(
        'INSERT INTO user_ai_settings (id, user_id, provider, api_key, model, is_active) VALUES ($1, $2, $3, $4, $5, 1)',
        ['test-demo-id', user.id, 'openai', 'sk-real-secret-key', 'gpt-4'],
      );

      const res = await request(app)
        .get('/api/ai/settings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.apiKey).toBe('sk-****');
      expect(res.body.providerConfigs.openai.apiKey).toBe('sk-****');
      expect(res.body.source).toBe('user');
    });

    it('non-demo user sees standard masked keys', async () => {
      const { token, user } = await createTestUser(app);

      const { query: dbQuery } = await import('../db.js');
      dbQuery(
        'INSERT INTO user_ai_settings (id, user_id, provider, api_key, model, is_active) VALUES ($1, $2, $3, $4, $5, 1)',
        ['test-normal-id', user.id, 'openai', 'sk-real-secret-key', 'gpt-4'],
      );

      const res = await request(app)
        .get('/api/ai/settings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.apiKey).toBe('****');
      expect(res.body.providerConfigs.openai.apiKey).toBe('****');
    });
  });

  describe('PUT /api/ai/settings', () => {
    it('blocks demo user with 403 DEMO_RESTRICTION', async () => {
      const { token } = await createTestUser(app, { email: 'demo@openbin.local' });

      const res = await request(app)
        .put('/api/ai/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('DEMO_RESTRICTION');
    });

    it('allows non-demo user', async () => {
      const { token } = await createTestUser(app);

      const res = await request(app)
        .put('/api/ai/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4' });

      expect(res.status).not.toBe(403);
    });

    it('blocks demo user setting customPrompt with 403 DEMO_RESTRICTION', async () => {
      const { token, user } = await createTestUser(app, { email: 'demo@openbin.local' });

      const { query: dbQuery } = await import('../db.js');
      dbQuery(
        'INSERT INTO user_ai_settings (id, user_id, provider, api_key, model, is_active) VALUES ($1, $2, $3, $4, $5, 1)',
        ['demo-prompt-id', user.id, 'openai', 'sk-real-key', 'gpt-4'],
      );

      const res = await request(app)
        .put('/api/ai/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ provider: 'openai', apiKey: 'sk-****', model: 'gpt-4', customPrompt: 'injected prompt' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('DEMO_RESTRICTION');
      expect(res.body.message).toBe('Demo accounts cannot customize AI prompts');
    });

    it('blocks demo user setting commandPrompt with 403 DEMO_RESTRICTION', async () => {
      const { token, user } = await createTestUser(app, { email: 'demo@openbin.local' });

      const { query: dbQuery } = await import('../db.js');
      dbQuery(
        'INSERT INTO user_ai_settings (id, user_id, provider, api_key, model, is_active) VALUES ($1, $2, $3, $4, $5, 1)',
        ['demo-cmd-id', user.id, 'openai', 'sk-real-key', 'gpt-4'],
      );

      const res = await request(app)
        .put('/api/ai/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ provider: 'openai', apiKey: 'sk-****', model: 'gpt-4', commandPrompt: 'injected command' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('DEMO_RESTRICTION');
    });

    it('allows demo user to change temperature without prompt fields', async () => {
      const { token, user } = await createTestUser(app, { email: 'demo@openbin.local' });

      const { query: dbQuery } = await import('../db.js');
      dbQuery(
        'INSERT INTO user_ai_settings (id, user_id, provider, api_key, model, is_active) VALUES ($1, $2, $3, $4, $5, 1)',
        ['demo-temp-id', user.id, 'openai', 'sk-real-key', 'gpt-4'],
      );

      const res = await request(app)
        .put('/api/ai/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ provider: 'openai', apiKey: 'sk-****', model: 'gpt-4', temperature: 0.5 });

      expect(res.status).not.toBe(403);
    });

    it('allows non-demo user to set customPrompt', async () => {
      const { token } = await createTestUser(app);

      const res = await request(app)
        .put('/api/ai/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4', customPrompt: 'my custom prompt' });

      expect(res.status).not.toBe(403);
    });
  });

  describe('POST /api/ai/test', () => {
    it('blocks demo user with 403 DEMO_RESTRICTION', async () => {
      const { token } = await createTestUser(app, { email: 'demo@openbin.local' });

      const res = await request(app)
        .post('/api/ai/test')
        .set('Authorization', `Bearer ${token}`)
        .send({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('DEMO_RESTRICTION');
    });

    it('allows non-demo user', async () => {
      const { token } = await createTestUser(app);

      const res = await request(app)
        .post('/api/ai/test')
        .set('Authorization', `Bearer ${token}`)
        .send({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4' });

      // Will fail on connection (not 403) since there's no real API to hit
      expect(res.status).not.toBe(403);
    });
  });
});
