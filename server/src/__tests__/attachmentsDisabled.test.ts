import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/config.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/config.js')>('../lib/config.js');
  return {
    ...actual,
    config: { ...actual.config, attachmentsEnabled: false },
  };
});

const { createApp } = await import('../index.js');
const { createTestBin, createTestLocation, createTestUser } = await import('./helpers.js');

let app: Express;
beforeEach(() => {
  app = createApp();
});

describe('Attachments: feature flag off', () => {
  it('returns 404 on the list endpoint', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .get(`/api/bins/${bin.id}/attachments`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 on the upload endpoint', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'x.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(404);
  });

  it('returns 404 on the file download endpoint', async () => {
    const { token } = await createTestUser(app);
    const res = await request(app)
      .get('/api/attachments/ABCDEF/file')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 on the delete endpoint', async () => {
    const { token } = await createTestUser(app);
    const res = await request(app)
      .delete('/api/attachments/ABCDEF')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
