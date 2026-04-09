import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const mockVerifyBinAccess = vi.fn();

vi.mock('../../db.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  d: { now: () => "datetime('now')" },
  generateUuid: () => 'test-uuid',
}));
vi.mock('../../lib/config.js', () => ({
  config: { selfHosted: true, disableRateLimit: true },
}));
vi.mock('../../lib/binAccess.js', () => ({
  verifyBinAccess: (...args: unknown[]) => mockVerifyBinAccess(...args),
}));
vi.mock('../../lib/planGate.js', () => ({
  checkLocationWritable: () => ({ writable: true }),
  getEffectiveMemberRole: (_u: string, _l: string, role: string) => role,
  generateUpgradeUrl: () => null,
  getUserPlanInfo: () => null,
}));

const { default: router } = await import('../scanHistory.js');

// Extract the asyncHandler-wrapped POST / handler
function getPostHandler() {
  const layer = (router as any).stack.find(
    (l: any) => l.route?.path === '/' && l.route?.methods?.post
  );
  if (!layer) throw new Error('POST / route not found');
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe('POST /api/scan-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects scan for bin the user has no access to', async () => {
    mockVerifyBinAccess.mockResolvedValueOnce(null);

    const handler = getPostHandler();
    const req = { body: { binId: 'ABC123' }, user: { id: 'attacker-user' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    const error = next.mock.calls[0][0];
    expect(error).toBeDefined();
    expect(error.status || error.statusCode).toBe(404);
  });

  it('rejects scan for private bin owned by another user', async () => {
    // verifyBinAccess returns null for private bins not owned by the user
    mockVerifyBinAccess.mockResolvedValueOnce(null);

    const handler = getPostHandler();
    const req = { body: { binId: 'PRIV01' }, user: { id: 'other-user' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    const error = next.mock.calls[0][0];
    expect(error.status || error.statusCode).toBe(404);
  });

  it('allows scan when user has access to the bin', async () => {
    mockVerifyBinAccess.mockResolvedValueOnce({ locationId: 'loc-1', visibility: 'location', createdBy: 'user-1', name: 'Test' });
    // INSERT scan history
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // DELETE trim old entries
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const handler = getPostHandler();
    const req = { body: { binId: 'ABC123' }, user: { id: 'valid-user' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(res.status).toHaveBeenCalled());

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
