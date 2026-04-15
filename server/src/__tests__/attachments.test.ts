import fs from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { config } from '../lib/config.js';
import { createTestBin, createTestLocation, createTestUser } from './helpers.js';

const ATTACHMENT_DIR = path.join(config.photoStoragePath, 'attachments');
const PDF_BUFFER = Buffer.from('%PDF-1.4\n%EOF', 'utf-8');

let app: Express;
beforeEach(() => {
  app = createApp();
});

afterEach(() => {
  try {
    fs.rmSync(ATTACHMENT_DIR, { recursive: true, force: true });
  } catch { /* ignore */ }
});

describe('Attachments: full lifecycle (upload → list → download → delete)', () => {
  it('lets a member upload, list, download, and delete an attachment', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const upload = await request(app)
      .post(`/api/bins/${bin.id}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PDF_BUFFER, { filename: 'spec.pdf', contentType: 'application/pdf' });
    expect(upload.status).toBe(201);
    expect(typeof upload.body.id).toBe('string');
    expect(upload.body.id).toHaveLength(6);
    const attachmentId = upload.body.id as string;

    const list = await request(app)
      .get(`/api/bins/${bin.id}/attachments`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(1);
    expect(list.body.results[0]).toMatchObject({
      id: attachmentId,
      bin_id: bin.id,
      filename: 'spec.pdf',
      mime_type: 'application/pdf',
      size: PDF_BUFFER.length,
    });

    const download = await request(app)
      .get(`/api/attachments/${attachmentId}/file`)
      .set('Authorization', `Bearer ${token}`);
    expect(download.status).toBe(200);
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(download.headers['content-disposition']).toContain('spec.pdf');
    expect(download.headers['content-type']).toMatch(/application\/pdf/);
    expect(Buffer.from(download.body).toString('utf-8')).toBe(PDF_BUFFER.toString('utf-8'));

    const del = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const listAfter = await request(app)
      .get(`/api/bins/${bin.id}/attachments`)
      .set('Authorization', `Bearer ${token}`);
    expect(listAfter.body.count).toBe(0);
  });

  it('rejects image uploads (they belong in the photos feature)', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    const res = await request(app)
      .post(`/api/bins/${bin.id}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake'), { filename: 'pic.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(422);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/bins/anything/attachments');
    expect(res.status).toBe(401);
  });
});
