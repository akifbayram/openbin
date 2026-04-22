import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockWithTransaction = vi.fn();
const mockRequireMemberOrAbove = vi.fn();

vi.mock('../../db.js', () => ({
  d: { now: () => "datetime('now')" },
  query: vi.fn(),
  withTransaction: (fn: any) => mockWithTransaction(fn),
  generateUuid: () => 'uuid-fixed',
}));
vi.mock('../../lib/binAccess.js', () => ({
  requireMemberOrAbove: (...a: unknown[]) => mockRequireMemberOrAbove(...a),
  verifyBinAccess: vi.fn(async () => ({ locationId: 'loc-1', name: 'Bin' })),
  verifyLocationMembership: vi.fn(async () => true),
}));
vi.mock('../../lib/routeHelpers.js', () => ({ logRouteActivity: vi.fn() }));
vi.mock('../../middleware/auth.js', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../middleware/locationAccess.js', () => ({ requireLocationMember: () => (_req: any, _res: any, next: any) => next() }));
vi.mock('../../lib/config.js', () => ({ config: { bulkMaxSelection: 200 } }));

const { locationCheckoutsRouter } = await import('../itemCheckouts.js');

function findHandler(method: 'post', path: string) {
  const layer = (locationCheckoutsRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method],
  );
  if (!layer) throw new Error(`${method.toUpperCase()} ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function makeReq(body: any = {}, params: any = {}) {
  return { body, params, user: { id: 'user-1' }, query: {} } as any;
}
function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn();
  return res;
}

describe('POST /api/locations/:locationId/checkouts/bulk-return', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireMemberOrAbove.mockResolvedValue(undefined);
  });

  it('rejects empty checkoutIds', async () => {
    const handler = findHandler('post', '/:locationId/checkouts/bulk-return');
    const req = makeReq({ checkoutIds: [] }, { locationId: 'loc-1' });
    const res = makeRes();
    const next = vi.fn();
    handler(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());
    expect(next.mock.calls[0][0].statusCode).toBe(422);
  });

  it('returns N items to their origins (no targetBinId)', async () => {
    mockWithTransaction.mockImplementation(async (fn: any) => {
      const tx = vi.fn();
      // Lookup active checkouts in this location
      tx.mockResolvedValueOnce({ rows: [
        { id: 'co-1', item_id: 'i-1', origin_bin_id: 'bin-A', location_id: 'loc-1' },
        { id: 'co-2', item_id: 'i-2', origin_bin_id: 'bin-B', location_id: 'loc-1' },
      ]});
      // Close checkout updates
      tx.mockResolvedValueOnce({ rows: [{ id: 'co-1' }] });
      tx.mockResolvedValueOnce({ rows: [{ id: 'co-2' }] });
      // Bin touches
      tx.mockResolvedValueOnce({ rows: [] });
      return fn(tx);
    });
    const handler = findHandler('post', '/:locationId/checkouts/bulk-return');
    const req = makeReq({ checkoutIds: ['co-1', 'co-2'] }, { locationId: 'loc-1' });
    const res = makeRes();
    handler(req, res, vi.fn());
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ returned: 2, errors: [] }));
  });

  it('returns N items to a chosen target bin', async () => {
    mockWithTransaction.mockImplementation(async (fn: any) => {
      const tx = vi.fn();
      // target bin lookup
      tx.mockResolvedValueOnce({ rows: [{ id: 'bin-target', location_id: 'loc-1', name: 'Garage A' }] });
      // active checkouts
      tx.mockResolvedValueOnce({ rows: [
        { id: 'co-1', item_id: 'i-1', origin_bin_id: 'bin-A', location_id: 'loc-1' },
      ]});
      // max position
      tx.mockResolvedValueOnce({ rows: [{ max_pos: 3 }] });
      // move item
      tx.mockResolvedValueOnce({ rows: [{ id: 'i-1' }] });
      // close checkout
      tx.mockResolvedValueOnce({ rows: [{ id: 'co-1' }] });
      // bins touch
      tx.mockResolvedValueOnce({ rows: [] });
      return fn(tx);
    });
    const handler = findHandler('post', '/:locationId/checkouts/bulk-return');
    const req = makeReq({ checkoutIds: ['co-1'], targetBinId: 'bin-target' }, { locationId: 'loc-1' });
    const res = makeRes();
    handler(req, res, vi.fn());
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ returned: 1 }));
  });

  it('skips already-returned checkouts via errors', async () => {
    mockWithTransaction.mockImplementation(async (fn: any) => {
      const tx = vi.fn();
      tx.mockResolvedValueOnce({ rows: [
        { id: 'co-1', item_id: 'i-1', origin_bin_id: 'bin-A', location_id: 'loc-1' },
      ]});
      tx.mockResolvedValueOnce({ rows: [{ id: 'co-1' }] });
      tx.mockResolvedValueOnce({ rows: [] });
      return fn(tx);
    });
    const handler = findHandler('post', '/:locationId/checkouts/bulk-return');
    const req = makeReq({ checkoutIds: ['co-1', 'co-missing'] }, { locationId: 'loc-1' });
    const res = makeRes();
    handler(req, res, vi.fn());
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());
    const body = res.json.mock.calls[0][0];
    expect(body.returned).toBe(1);
    expect(body.errors).toEqual([{ id: 'co-missing', reason: 'NOT_FOUND' }]);
  });
});
