import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../db.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  d: {
    now: () => "datetime('now')",
    today: () => "date('now')",
  },
}));

const { recordBinUsage, getUserUsageTrackingPrefs } = await import('../recordBinUsage.js');

describe('recordBinUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('inserts a row for (bin, today) with count=1', async () => {
    await recordBinUsage('bin-1', 'user-1');

    const today = new Date().toISOString().slice(0, 10);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO bin_usage_days');
    expect(sql).toContain('ON CONFLICT (bin_id, date) DO UPDATE');
    expect(sql).toContain('count = bin_usage_days.count + 1');
    expect(params).toEqual(['bin-1', today, 'user-1']);
  });

  it('accepts null userId (e.g. api-key calls where user context is thin)', async () => {
    await recordBinUsage('bin-1', null);

    const today = new Date().toISOString().slice(0, 10);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [, params] = mockQuery.mock.calls[0];
    expect(params).toEqual(['bin-1', today, null]);
  });

  it('swallows errors so callers never have to catch', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    await expect(recordBinUsage('bin-1', 'user-1')).resolves.toBeUndefined();
  });

  it('uses UTC date (not local) when computing today', async () => {
    vi.useFakeTimers();
    try {
      // Set wall clock to 2026-04-12T23:59:00Z — late evening UTC
      vi.setSystemTime(new Date('2026-04-12T23:59:00Z'));
      await recordBinUsage('bin-1', 'user-1');

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [, params] = mockQuery.mock.calls[0];
      expect(params).toEqual(['bin-1', '2026-04-12', 'user-1']);

      mockQuery.mockClear();

      // Advance past UTC midnight
      vi.setSystemTime(new Date('2026-04-13T00:01:00Z'));
      await recordBinUsage('bin-1', 'user-1');

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [, params2] = mockQuery.mock.calls[0];
      expect(params2).toEqual(['bin-1', '2026-04-13', 'user-1']);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('getUserUsageTrackingPrefs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns defaults when user has no preferences row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const prefs = await getUserUsageTrackingPrefs('user-1');
    expect(prefs).toEqual({ scan: true, manual_lookup: true, view: false, modify: false });
  });

  it('parses existing preferences JSON', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ settings: JSON.stringify({ usage_tracking_scan: false, usage_tracking_view: true }) }],
      rowCount: 1,
    });
    const prefs = await getUserUsageTrackingPrefs('user-1');
    expect(prefs.scan).toBe(false);
    expect(prefs.manual_lookup).toBe(true);  // default
    expect(prefs.view).toBe(true);
    expect(prefs.modify).toBe(false);  // default
  });

  it('handles settings stored as already-parsed object (pg JSONB)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ settings: { usage_tracking_scan: false } }],
      rowCount: 1,
    });
    const prefs = await getUserUsageTrackingPrefs('user-1');
    expect(prefs.scan).toBe(false);
  });

  it('returns defaults if settings JSON is malformed', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ settings: 'not json' }],
      rowCount: 1,
    });
    const prefs = await getUserUsageTrackingPrefs('user-1');
    expect(prefs).toEqual({ scan: true, manual_lookup: true, view: false, modify: false });
  });
});
