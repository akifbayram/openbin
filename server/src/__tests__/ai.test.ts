import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('GET /api/ai/default-prompts', () => {
  it('returns prompts object', async () => {
    const { token } = await createTestUser(app);
    const res = await request(app)
      .get('/api/ai/default-prompts')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('object');
    expect(Object.keys(res.body).length).toBeGreaterThan(0);
  });
});

describe('auth enforcement', () => {
  it('GET /api/ai/settings returns 401 without auth', async () => {
    const res = await request(app).get('/api/ai/settings');
    expect(res.status).toBe(401);
  });

  it('PUT /api/ai/settings returns 401 without auth', async () => {
    const res = await request(app)
      .put('/api/ai/settings')
      .send({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/ai/settings (no config)', () => {
  it('returns null when no settings configured', async () => {
    const { token } = await createTestUser(app);
    const res = await request(app)
      .get('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

describe('PUT /api/ai/settings', () => {
  it('saves settings successfully', async () => {
    const { token } = await createTestUser(app);
    const res = await request(app)
      .put('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', apiKey: 'sk-test-key-12345', model: 'gpt-4' });
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('openai');
    expect(res.body.model).toBe('gpt-4');
    expect(res.body.source).toBe('user');
    // API key should be masked
    expect(res.body.apiKey).not.toBe('sk-test-key-12345');
    expect(res.body.apiKey).toContain('*');
  });

  it('returns saved settings on subsequent GET', async () => {
    const { token } = await createTestUser(app);
    await request(app)
      .put('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', apiKey: 'sk-test-key-12345', model: 'gpt-4' });

    const res = await request(app)
      .get('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('openai');
    expect(res.body.model).toBe('gpt-4');
    expect(res.body.source).toBe('user');
    expect(res.body.apiKey).toContain('*');
  });

  it('saves optional parameters', async () => {
    const { token } = await createTestUser(app);
    const res = await request(app)
      .put('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'openai',
        apiKey: 'sk-test-key-12345',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 4000,
        topP: 0.9,
        requestTimeout: 60,
        customPrompt: 'Be concise.',
      });
    expect(res.status).toBe(200);
    expect(res.body.temperature).toBe(0.7);
    expect(res.body.maxTokens).toBe(4000);
    expect(res.body.topP).toBe(0.9);
    expect(res.body.requestTimeout).toBe(60);
    expect(res.body.customPrompt).toBe('Be concise.');
  });

  it('returns providerConfigs with saved settings', async () => {
    const { token } = await createTestUser(app);
    await request(app)
      .put('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', apiKey: 'sk-test-key-12345', model: 'gpt-4' });

    const res = await request(app)
      .get('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.providerConfigs).toBeDefined();
    expect(res.body.providerConfigs.openai).toBeDefined();
    expect(res.body.providerConfigs.openai.model).toBe('gpt-4');
  });
});

describe('DELETE /api/ai/settings', () => {
  it('deletes settings', async () => {
    const { token } = await createTestUser(app);
    await request(app)
      .put('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', apiKey: 'sk-test-key-12345', model: 'gpt-4' });

    const delRes = await request(app)
      .delete('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.deleted).toBe(true);

    const getRes = await request(app)
      .get('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toBeNull();
  });
});

describe('PUT /api/ai/settings validation', () => {
  let token: string;

  beforeEach(async () => {
    const user = await createTestUser(app);
    token = user.token;
  });

  it('422 for missing provider', async () => {
    const res = await request(app)
      .put('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ apiKey: 'sk-test', model: 'gpt-4' });
    expect(res.status).toBe(422);
  });

  it('422 for missing apiKey', async () => {
    const res = await request(app)
      .put('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', model: 'gpt-4' });
    expect(res.status).toBe(422);
  });

  it('422 for invalid provider', async () => {
    const res = await request(app)
      .put('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'invalid', apiKey: 'sk-test', model: 'gpt-4' });
    expect(res.status).toBe(422);
  });

  it('422 for temperature > 2', async () => {
    const res = await request(app)
      .put('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4', temperature: 3 });
    expect(res.status).toBe(422);
    expect(res.body.message).toContain('temperature');
  });

  it('422 for maxTokens < 100', async () => {
    const res = await request(app)
      .put('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4', maxTokens: 50 });
    expect(res.status).toBe(422);
    expect(res.body.message).toContain('maxTokens');
  });

  it('422 for topP > 1', async () => {
    const res = await request(app)
      .put('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4', topP: 1.5 });
    expect(res.status).toBe(422);
    expect(res.body.message).toContain('topP');
  });

  it('422 for requestTimeout > 300', async () => {
    const res = await request(app)
      .put('/api/ai/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4', requestTimeout: 500 });
    expect(res.status).toBe(422);
    expect(res.body.message).toContain('requestTimeout');
  });
});

describe('POST /api/ai/structure-text', () => {
  it('422 for missing text', async () => {
    const { token } = await createTestUser(app);
    const res = await request(app)
      .post('/api/ai/structure-text')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('422 when no AI settings configured', async () => {
    const { token } = await createTestUser(app);
    const res = await request(app)
      .post('/api/ai/structure-text')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'screwdrivers and hammers' });
    expect(res.status).toBe(422);
    expect(res.body.message).toContain('AI');
  });
});

describe('POST /api/ai/test', () => {
  it('422 for missing required fields', async () => {
    const { token } = await createTestUser(app);
    const res = await request(app)
      .post('/api/ai/test')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/ai/analyze', () => {
  it('422 for missing photoId', async () => {
    const { token } = await createTestUser(app);
    const res = await request(app)
      .post('/api/ai/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(422);
  });
});
