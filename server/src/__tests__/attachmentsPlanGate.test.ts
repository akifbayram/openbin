import fs from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Force cloud-mode plan gating for this suite.
vi.mock('../lib/planGate.js', async (importActual) => {
  const actual = await importActual<typeof import('../lib/planGate.js')>();
  return {
    ...actual,
    isSelfHosted: vi.fn(),
    getUserPlanInfo: vi.fn(),
    isSubscriptionActive: vi.fn(),
    isProUser: vi.fn(),
    generateUpgradeUrl: vi.fn(),
  };
});

// ---- Imports (after mocks) ----

import { getDb } from '../db.js';
import { createApp } from '../index.js';
import { config } from '../lib/config.js';
import {
  generateUpgradeUrl,
  getUserPlanInfo,
  isProUser,
  isSelfHosted,
  isSubscriptionActive,
  Plan,
  SubStatus,
} from '../lib/planGate.js';
import { createTestBin, createTestLocation, createTestUser } from './helpers.js';

const ATTACHMENT_DIR = path.join(config.photoStoragePath, 'attachments');
const PDF_BUFFER = Buffer.from('%PDF-1.4\n%EOF', 'utf-8');

let app: Express;

beforeEach(() => {
  app = createApp();
  vi.mocked(generateUpgradeUrl).mockResolvedValue(null);
});

afterEach(() => {
  try {
    fs.rmSync(ATTACHMENT_DIR, { recursive: true, force: true });
  } catch { /* ignore */ }
});

/** Direct DB update — users default to PRO in schema.sqlite.sql. */
function setUserPlan(userId: string, plan: 'free' | 'plus' | 'pro'): void {
  const code = plan === 'pro' ? 1 : plan === 'plus' ? 0 : 2;
  getDb().prepare('UPDATE users SET plan = ? WHERE id = ?').run(code, userId);
}

/** Configure mocks for a cloud Free user: gate fires, check fails. */
function mockFreeUser(): void {
  vi.mocked(isSelfHosted).mockReturnValue(false);
  vi.mocked(getUserPlanInfo).mockResolvedValue({
    plan: Plan.FREE,
    subStatus: SubStatus.ACTIVE,
    activeUntil: null,
    email: 'free@example.com',
    previousSubStatus: null,
  });
  vi.mocked(isSubscriptionActive).mockReturnValue(true);
  vi.mocked(isProUser).mockReturnValue(false);
}

/** Configure mocks for a cloud Plus user: gate fires, check fails. */
function mockPlusUser(): void {
  vi.mocked(isSelfHosted).mockReturnValue(false);
  vi.mocked(getUserPlanInfo).mockResolvedValue({
    plan: Plan.PLUS,
    subStatus: SubStatus.ACTIVE,
    activeUntil: null,
    email: 'plus@example.com',
    previousSubStatus: null,
  });
  vi.mocked(isSubscriptionActive).mockReturnValue(true);
  vi.mocked(isProUser).mockReturnValue(false);
}

/** Configure mocks for a cloud Pro user: gate fires, check passes. */
function mockProUser(): void {
  vi.mocked(isSelfHosted).mockReturnValue(false);
  vi.mocked(getUserPlanInfo).mockResolvedValue({
    plan: Plan.PRO,
    subStatus: SubStatus.ACTIVE,
    activeUntil: null,
    email: 'pro@example.com',
    previousSubStatus: null,
  });
  vi.mocked(isSubscriptionActive).mockReturnValue(true);
  vi.mocked(isProUser).mockReturnValue(true);
}

describe('Attachments plan gate', () => {
  it('rejects upload with PLAN_RESTRICTED for a Free-plan user', async () => {
    const { token, user } = await createTestUser(app);
    setUserPlan(user.id, 'free');
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    mockFreeUser();

    const res = await request(app)
      .post(`/api/bins/${bin.id}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PDF_BUFFER, { filename: 'spec.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PLAN_RESTRICTED');
  });

  it('rejects upload for a Plus-plan user (default config)', async () => {
    const { token, user } = await createTestUser(app);
    setUserPlan(user.id, 'plus');
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    mockPlusUser();

    const res = await request(app)
      .post(`/api/bins/${bin.id}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PDF_BUFFER, { filename: 'spec.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PLAN_RESTRICTED');
  });

  it('allows upload for a Pro-plan user', async () => {
    const { token, user } = await createTestUser(app);
    setUserPlan(user.id, 'pro');
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    mockProUser();

    const res = await request(app)
      .post(`/api/bins/${bin.id}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PDF_BUFFER, { filename: 'spec.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe('string');
  });

  it('allows list / download / delete for a Free-plan user (legacy attachments remain accessible)', async () => {
    // Upload as Pro, then downgrade and verify read access persists.
    const { token, user } = await createTestUser(app);
    setUserPlan(user.id, 'pro');
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id);

    mockProUser();

    const upload = await request(app)
      .post(`/api/bins/${bin.id}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PDF_BUFFER, { filename: 'spec.pdf', contentType: 'application/pdf' });
    expect(upload.status).toBe(201);
    const attachmentId = upload.body.id as string;

    setUserPlan(user.id, 'free');
    mockFreeUser();

    const list = await request(app)
      .get(`/api/bins/${bin.id}/attachments`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(1);

    const download = await request(app)
      .get(`/api/attachments/${attachmentId}/file`)
      .set('Authorization', `Bearer ${token}`);
    expect(download.status).toBe(200);

    const del = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
  });
});
