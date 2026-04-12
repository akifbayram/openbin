import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const mockVerifyBinAccess = vi.fn();
const mockRecordBinUsage = vi.fn();
const mockGetPrefs = vi.fn();

vi.mock('../../db.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  d: { now: () => "datetime('now')", today: () => "date('now')" },
  generateUuid: () => 'test-uuid',
}));
vi.mock('../../lib/config.js', () => ({
  config: { selfHosted: true, disableRateLimit: true },
}));
vi.mock('../../lib/binAccess.js', () => ({
  verifyBinAccess: (...args: unknown[]) => mockVerifyBinAccess(...args),
}));
vi.mock('../../lib/recordBinUsage.js', () => ({
  recordBinUsage: (...args: unknown[]) => mockRecordBinUsage(...args),
  getUserUsageTrackingPrefs: (...args: unknown[]) => mockGetPrefs(...args),
}));

const { default: router } = await import('../binUsage.js');

function findHandler(method: 'get' | 'post', path: string) {
  const layer = (router as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method],
  );
  if (!layer) throw new Error(`${method.toUpperCase()} ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe('GET /api/bins/:id/usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 for bins the user cannot access', async () => {
    mockVerifyBinAccess.mockResolvedValueOnce(null);
    const handler = findHandler('get', '/:id/usage');
    const req = { params: { id: 'bin-1' }, user: { id: 'user-1' } } as any;
    const res = { json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(next.mock.calls[0][0].statusCode).toBe(404);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('returns usage rows for accessible bins', async () => {
    mockVerifyBinAccess.mockResolvedValueOnce({ locationId: 'loc-1', visibility: 'location', createdBy: 'user-1', name: 'Test' });
    mockQuery.mockResolvedValueOnce({
      rows: [
        { date: '2026-04-12', count: 3 },
        { date: '2026-04-10', count: 1 },
      ],
      rowCount: 2,
    });

    const handler = findHandler('get', '/:id/usage');
    const req = { params: { id: 'bin-1' }, user: { id: 'user-1' } } as any;
    const res = { json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());

    expect(res.json).toHaveBeenCalledWith({
      results: [
        { date: '2026-04-12', count: 3 },
        { date: '2026-04-10', count: 1 },
      ],
      count: 2,
    });
  });
});

describe('GET /api/bins/:id/usage with empty data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty results envelope when bin has no usage rows', async () => {
    mockVerifyBinAccess.mockResolvedValueOnce({ locationId: 'loc-1', visibility: 'location', createdBy: 'user-1', name: 'Test' });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const handler = findHandler('get', '/:id/usage');
    const req = { params: { id: 'bin-1' }, user: { id: 'user-1' } } as any;
    const res = { json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());

    expect(res.json).toHaveBeenCalledWith({ results: [], count: 0 });
  });
});

describe('POST /api/bins/:id/usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 422 if trigger is missing', async () => {
    const handler = findHandler('post', '/:id/usage');
    const req = { params: { id: 'bin-1' }, body: {}, user: { id: 'user-1' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(next.mock.calls[0][0].statusCode).toBe(422);
  });

  it('returns 422 for unknown trigger value', async () => {
    const handler = findHandler('post', '/:id/usage');
    const req = { params: { id: 'bin-1' }, body: { trigger: 'random' }, user: { id: 'user-1' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(next.mock.calls[0][0].statusCode).toBe(422);
  });

  it('returns 404 when bin is not accessible', async () => {
    mockVerifyBinAccess.mockResolvedValueOnce(null);
    const handler = findHandler('post', '/:id/usage');
    const req = { params: { id: 'bin-1' }, body: { trigger: 'scan' }, user: { id: 'user-1' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(next.mock.calls[0][0].statusCode).toBe(404);
  });

  it('records usage when scan trigger is enabled in prefs', async () => {
    mockVerifyBinAccess.mockResolvedValueOnce({ locationId: 'loc-1', visibility: 'location', createdBy: 'user-1', name: 'Test' });
    mockGetPrefs.mockResolvedValueOnce({ scan: true, manual_lookup: true, view: false, modify: false });

    const handler = findHandler('post', '/:id/usage');
    const req = { params: { id: 'bin-1' }, body: { trigger: 'scan' }, user: { id: 'user-1' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());

    expect(mockRecordBinUsage).toHaveBeenCalledWith('bin-1', 'user-1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ ok: true, recorded: true });
  });

  it('does not record when trigger is disabled in prefs', async () => {
    mockVerifyBinAccess.mockResolvedValueOnce({ locationId: 'loc-1', visibility: 'location', createdBy: 'user-1', name: 'Test' });
    mockGetPrefs.mockResolvedValueOnce({ scan: false, manual_lookup: true, view: false, modify: false });

    const handler = findHandler('post', '/:id/usage');
    const req = { params: { id: 'bin-1' }, body: { trigger: 'scan' }, user: { id: 'user-1' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());

    expect(mockRecordBinUsage).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, recorded: false });
  });

  it('checks manual_lookup pref for trigger=manual', async () => {
    mockVerifyBinAccess.mockResolvedValueOnce({ locationId: 'loc-1', visibility: 'location', createdBy: 'user-1', name: 'Test' });
    mockGetPrefs.mockResolvedValueOnce({ scan: true, manual_lookup: false, view: false, modify: false });

    const handler = findHandler('post', '/:id/usage');
    const req = { params: { id: 'bin-1' }, body: { trigger: 'manual' }, user: { id: 'user-1' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());

    expect(mockRecordBinUsage).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, recorded: false });
  });
});
