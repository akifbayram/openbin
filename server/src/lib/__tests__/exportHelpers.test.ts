import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the database module
const mockQuery = vi.fn();
vi.mock('../../db.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  d: {
    jsonGroupArray: (expr: string) => `json_group_array(${expr})`,
    jsonObject: (...args: string[]) => `json_object(${args.join(', ')})`,
    jsonGroupObject: (k: string, v: string) => `json_group_object(${k}, ${v})`,
    now: () => "datetime('now')",
  },
  generateUuid: () => 'test-uuid',
  isUniqueViolation: () => false,
}));
vi.mock('../config.js', () => ({
  config: { photoStoragePath: '/tmp/photos' },
}));
vi.mock('../storage.js', () => ({
  storage: { readStream: vi.fn(), exists: vi.fn(), delete: vi.fn() },
}));
vi.mock('../customFieldHelpers.js', () => ({
  replaceCustomFieldValues: vi.fn(),
}));
vi.mock('../shortCode.js', () => ({
  generateShortCode: () => 'ABC123',
}));
vi.mock('../pathSafety.js', () => ({
  isPathSafe: () => true,
  safePath: (base: string, rel: string) => `${base}/${rel}`,
}));
vi.mock('../logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { fetchLocationBins, fetchTrashedBins, fetchLocationPinnedBins, fetchLocationSavedViews } = await import('../exportHelpers.js');

describe('fetchLocationBins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes visibility filter in SQL when userId provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await fetchLocationBins('loc-1', 'user-1');

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('visibility');
    expect(sql).toContain('created_by');
    const params = mockQuery.mock.calls[0][1] as string[];
    expect(params).toEqual(['loc-1', 'user-1']);
  });

  it('omits visibility filter when no userId provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await fetchLocationBins('loc-1');

    const sql = mockQuery.mock.calls[0][0] as string;
    // Should not have the AND (visibility = ... OR created_by = ...) clause
    expect(sql).not.toMatch(/AND \(b\.visibility = 'location' OR b\.created_by/);
    const params = mockQuery.mock.calls[0][1] as string[];
    expect(params).toEqual(['loc-1']);
  });
});

describe('fetchTrashedBins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes visibility filter in SQL when userId provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await fetchTrashedBins('loc-1', 'user-1');

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('visibility');
    expect(sql).toContain('created_by');
    const params = mockQuery.mock.calls[0][1] as string[];
    expect(params).toEqual(['loc-1', 'user-1']);
  });
});

describe('fetchLocationPinnedBins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters to requesting user when userId provided', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ user_id: 'user-1', bin_id: 'bin-1', position: 0 }],
    });

    await fetchLocationPinnedBins('loc-1', 'user-1');

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('pb.user_id = $2');
    const params = mockQuery.mock.calls[0][1] as string[];
    expect(params).toEqual(['loc-1', 'user-1']);
  });

  it('returns all users when no userId provided', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { user_id: 'user-1', bin_id: 'bin-1', position: 0 },
        { user_id: 'user-2', bin_id: 'bin-2', position: 0 },
      ],
    });

    const result = await fetchLocationPinnedBins('loc-1');

    expect(result).toHaveLength(2);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).not.toContain('pb.user_id = $2');
  });
});

describe('fetchLocationSavedViews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters to requesting user when userId provided', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ user_id: 'user-1', name: 'My View', search_query: 'test', sort: 'name', filters: '{}' }],
    });

    await fetchLocationSavedViews('loc-1', 'user-1');

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('sv.user_id = $2');
    const params = mockQuery.mock.calls[0][1] as string[];
    expect(params).toEqual(['loc-1', 'user-1']);
  });

  it('returns all users when no userId provided', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { user_id: 'user-1', name: 'My View', search_query: 'test', sort: 'name', filters: '{}' },
        { user_id: 'user-2', name: 'Their View', search_query: 'secret', sort: 'name', filters: '{}' },
      ],
    });

    const result = await fetchLocationSavedViews('loc-1');

    expect(result).toHaveLength(2);
  });
});
