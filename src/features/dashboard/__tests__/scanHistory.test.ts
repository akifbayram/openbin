import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/lib/api';
import { recordScan } from '../scanHistory';

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recordScan', () => {
  it('calls POST /api/scan-history with binId', async () => {
    mockApiFetch.mockResolvedValue({ ok: true });

    await recordScan('bin-1');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/scan-history', {
      method: 'POST',
      body: { bin_id: 'bin-1' },
    });
  });

  it('does not throw on API error', async () => {
    mockApiFetch.mockRejectedValue(new Error('network'));

    await expect(recordScan('bin-1')).resolves.toBeUndefined();
  });
});
