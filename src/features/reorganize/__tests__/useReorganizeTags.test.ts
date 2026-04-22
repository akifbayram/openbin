import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiStream = vi.fn();
const mockApiFetch = vi.fn();

vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));
vi.mock('@/lib/apiStream', () => ({
  apiStream: (...args: unknown[]) => mockApiStream(...args),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ activeLocationId: 'loc-1', token: 'tok' }),
}));

const { useReorganizeTags } = await import('../useReorganizeTags');

async function* stream(events: any[]) {
  for (const e of events) yield e;
}

describe('useReorganizeTags', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('starts idle', () => {
    const { result } = renderHook(() => useReorganizeTags());
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.result).toBeNull();
  });

  it('streams and exposes result on done', async () => {
    const proposal = {
      taxonomy: { newTags: [{ tag: 'fasteners' }], renames: [], merges: [], parents: [] },
      assignments: [{ binId: 'bin-1', add: ['fasteners'], remove: [] }],
      summary: 'done',
    };
    mockApiStream.mockReturnValue(stream([
      { type: 'delta', text: JSON.stringify(proposal) },
      { type: 'done', text: JSON.stringify(proposal) },
    ]));
    const { result } = renderHook(() => useReorganizeTags());
    act(() => {
      result.current.start(
        [{ id: 'bin-1', name: 'K', items: [], tags: [], area_id: null, area_name: '' } as any],
        { changeLevel: 'additive', granularity: 'medium' },
      );
    });
    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(result.current.result!.taxonomy.newTags[0].tag).toBe('fasteners');
  });

  it('applies via POST /api/tags/bulk-apply', async () => {
    const proposal = {
      taxonomy: { newTags: [{ tag: 'fasteners' }], renames: [], merges: [], parents: [] },
      assignments: [{ binId: 'bin-1', add: ['fasteners'], remove: [] }],
      summary: 'done',
    };
    mockApiStream.mockReturnValue(stream([{ type: 'done', text: JSON.stringify(proposal) }]));
    mockApiFetch.mockResolvedValue({ tagsCreated: 1, tagsRenamed: 0, parentsSet: 0, binsAddedTo: 1, binsRemovedFrom: 0 });
    const { result } = renderHook(() => useReorganizeTags());
    act(() => {
      result.current.start(
        [{ id: 'bin-1', name: 'K', items: [], tags: [], area_id: null, area_name: '' } as any],
        { changeLevel: 'additive', granularity: 'medium' },
      );
    });
    await waitFor(() => expect(result.current.result).not.toBeNull());
    let ok = false;
    await act(async () => {
      ok = await result.current.apply(['bin-1'], {
        newTags: new Set(['fasteners']),
        renames: new Set(),
        merges: new Set(),
        parents: new Set(),
        assignments: new Set(['bin-1']),
      });
    });
    expect(ok).toBe(true);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/tags/bulk-apply', expect.objectContaining({ method: 'POST' }));
    const body = mockApiFetch.mock.calls[0][1].body;
    expect(body.assignments.add['bin-1']).toEqual(['fasteners']);
  });
});
