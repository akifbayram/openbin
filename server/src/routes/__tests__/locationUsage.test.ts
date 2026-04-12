import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const mockVerifyLocationMembership = vi.fn();

vi.mock('../../db.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  d: { now: () => "datetime('now')", today: () => "date('now')" },
  generateUuid: () => 'test-uuid',
}));
vi.mock('../../lib/config.js', () => ({
  config: { selfHosted: true, disableRateLimit: true },
}));
vi.mock('../../lib/binAccess.js', () => ({
  verifyLocationMembership: (...args: unknown[]) => mockVerifyLocationMembership(...args),
  requireMemberOrAbove: vi.fn(),
  requireAdmin: vi.fn(),
  getMemberRole: vi.fn(),
  isLocationAdmin: vi.fn(),
}));

const { default: router } = await import('../locations.js');

function findHandler(method: 'get', path: string) {
  const layer = (router as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method],
  );
  if (!layer) throw new Error(`${method.toUpperCase()} ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe('GET /api/locations/:id/usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when the user is not a member', async () => {
    mockVerifyLocationMembership.mockResolvedValueOnce(false);
    const handler = findHandler('get', '/:id/usage');
    const req = { params: { id: 'loc-1' }, user: { id: 'user-1' } } as any;
    const res = { json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it('returns aggregated daily counts for members', async () => {
    mockVerifyLocationMembership.mockResolvedValueOnce(true);
    mockQuery.mockResolvedValueOnce({
      rows: [
        { date: '2026-04-12', bin_count: 4, total_count: 11 },
        { date: '2026-04-10', bin_count: 2, total_count: 2 },
      ],
      rowCount: 2,
    });

    const handler = findHandler('get', '/:id/usage');
    const req = { params: { id: 'loc-1' }, user: { id: 'user-1' } } as any;
    const res = { json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());

    expect(res.json).toHaveBeenCalledWith({
      results: [
        { date: '2026-04-12', binCount: 4, totalCount: 11 },
        { date: '2026-04-10', binCount: 2, totalCount: 2 },
      ],
      count: 2,
    });
  });

  it('returns empty results envelope when no usage data exists', async () => {
    mockVerifyLocationMembership.mockResolvedValueOnce(true);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const handler = findHandler('get', '/:id/usage');
    const req = { params: { id: 'loc-1' }, user: { id: 'user-1' } } as any;
    const res = { json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());

    expect(res.json).toHaveBeenCalledWith({ results: [], count: 0 });
  });
});
