import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestBin, createTestLocation, createTestUser } from '../../__tests__/helpers.js';
import { createApp } from '../../index.js';
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_SIZE_MB } from '../../lib/uploadConfig.js';

let app: Express;
beforeEach(() => {
  app = createApp();
});

describe('POST /api/bins/:id/attachments — payload size cap', () => {
  it('rejects an oversize upload with a structured 413 (not 500 with empty body)', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    // 1 MB over the cap — Content-Length pre-check should fire BEFORE multer
    // buffers the request, so this never reaches disk/memory storage.
    const oversize = Buffer.alloc(MAX_ATTACHMENT_BYTES + 1024 * 1024, 0);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', oversize, { filename: 'huge.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(413);
    expect(res.body).toMatchObject({
      error: 'PAYLOAD_TOO_LARGE',
    });
    expect(typeof res.body.message).toBe('string');
    expect(res.body.message.length).toBeGreaterThan(0);
    expect(res.body.message).toContain(String(MAX_ATTACHMENT_SIZE_MB));
  });

  it('still accepts a normal under-cap upload', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const PDF_BUFFER = Buffer.from('%PDF-1.4\n%EOF', 'utf-8');
    const res = await request(app)
      .post(`/api/bins/${bin.id}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PDF_BUFFER, { filename: 'small.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe('string');
  });
});
