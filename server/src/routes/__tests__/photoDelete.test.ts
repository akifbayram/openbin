import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../db.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  d: { now: () => "datetime('now')" },
}));
vi.mock('../../lib/config.js', () => ({
  config: { selfHosted: true, disableRateLimit: true, photoStoragePath: '/tmp/photos' },
}));
vi.mock('../../lib/planGate.js', () => ({
  invalidateOverLimitCache: vi.fn(),
  checkLocationWritable: () => ({ writable: true }),
  getEffectiveMemberRole: (_u: string, _l: string, role: string) => role,
  generateUpgradeUrl: () => null,
  getUserPlanInfo: () => null,
}));
vi.mock('../../lib/storage.js', () => ({
  storage: { delete: vi.fn().mockResolvedValue(undefined), readStream: vi.fn(), exists: vi.fn() },
}));
vi.mock('../../lib/thumbnailPool.js', () => ({
  generateThumbnailBuffer: vi.fn(),
  closeThumbnailPool: vi.fn(),
}));
vi.mock('../../lib/routeHelpers.js', () => ({
  logRouteActivity: vi.fn(),
}));

const { default: router } = await import('../photos.js');

function getDeleteHandler() {
  const layer = (router as any).stack.find(
    (l: any) => l.route?.path === '/:id' && l.route?.methods?.delete
  );
  if (!layer) throw new Error('DELETE /:id route not found');
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe('DELETE /api/photos/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects deletion by a viewer', async () => {
    // verifyBinAttachmentAccess query → photo found, role is viewer
    mockQuery.mockResolvedValueOnce({
      rows: [{ bin_id: 'bin-1', bin_name: 'Test Bin', storage_path: 'bin-1/photo.jpg', mime_type: 'image/jpeg', location_id: 'loc-1', visibility: 'location', bin_created_by: 'user-2', role: 'viewer' }],
    });

    const handler = getDeleteHandler();
    const req = { params: { id: 'photo-1' }, user: { id: 'viewer-user' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    const error = next.mock.calls[0][0];
    expect(error).toBeDefined();
    expect(error.status || error.statusCode).toBe(403);
  });

  it('allows deletion by a member', async () => {
    // verifyBinAttachmentAccess → found with role: member (bin_name joined from bins table)
    mockQuery.mockResolvedValueOnce({
      rows: [{ bin_id: 'bin-1', bin_name: 'Test Bin', storage_path: 'bin-1/photo.jpg', mime_type: 'image/jpeg', location_id: 'loc-1', visibility: 'location', bin_created_by: 'user-1', role: 'member' }],
    });
    // thumb_path query
    mockQuery.mockResolvedValueOnce({ rows: [{ thumb_path: null }] });
    // DELETE photo
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // UPDATE bin updated_at
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const handler = getDeleteHandler();
    const req = { params: { id: 'photo-1' }, user: { id: 'member-user' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    handler(req, res, next);
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Photo deleted' });
  });
});
