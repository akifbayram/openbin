import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError, getAvatarUrl } from '@/lib/api';

function mockFetchResponse(overrides: Partial<Response> = {}, body?: string) {
  const res = {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: vi.fn().mockResolvedValue(body ? JSON.parse(body) : {}),
    text: vi.fn().mockResolvedValue(body ?? ''),
    ...overrides,
  } as unknown as Response;
  return res;
}

describe('apiFetch', () => {
  const fetchSpy = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    localStorage.clear();
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes credentials: same-origin', async () => {
    fetchSpy.mockResolvedValue(mockFetchResponse({}, '{"ok":true}'));

    await apiFetch('/api/test');

    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.credentials).toBe('same-origin');
  });

  it('does not set Authorization header (cookies handle auth)', async () => {
    fetchSpy.mockResolvedValue(mockFetchResponse({}, '{"ok":true}'));

    await apiFetch('/api/test');

    const [, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('sets Content-Type to application/json for object bodies', async () => {
    fetchSpy.mockResolvedValue(mockFetchResponse({}, '{"ok":true}'));

    await apiFetch('/api/test', { method: 'POST', body: { name: 'bin' } });

    const [, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('does not set Content-Type for FormData bodies', async () => {
    fetchSpy.mockResolvedValue(mockFetchResponse({}, '{"ok":true}'));
    const formData = new FormData();
    formData.append('file', 'data');

    await apiFetch('/api/upload', { method: 'POST', body: formData });

    const [, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('merges custom headers', async () => {
    fetchSpy.mockResolvedValue(mockFetchResponse({}, '{"ok":true}'));

    await apiFetch('/api/test', {
      method: 'POST',
      body: { a: 1 },
      headers: { 'X-Custom': 'value' },
    });

    const [, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Custom']).toBe('value');
  });

  it('JSON.stringifies the body for non-FormData', async () => {
    fetchSpy.mockResolvedValue(mockFetchResponse({}, '{"ok":true}'));
    const payload = { name: 'test', items: ['a', 'b'] };

    await apiFetch('/api/test', { method: 'POST', body: payload });

    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.body).toBe(JSON.stringify(payload));
  });

  it('passes FormData body as-is', async () => {
    fetchSpy.mockResolvedValue(mockFetchResponse({}, '{"ok":true}'));
    const formData = new FormData();
    formData.append('photo', 'blob');

    await apiFetch('/api/upload', { method: 'POST', body: formData });

    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.body).toBe(formData);
  });

  it('throws ApiError with status and message on non-ok response', async () => {
    const res = mockFetchResponse({ ok: false, status: 404, statusText: 'Not Found' });
    res.json = vi.fn().mockResolvedValue({ error: 'Bin not found' });
    fetchSpy.mockResolvedValue(res);

    await expect(apiFetch('/api/bins/123')).rejects.toThrow(ApiError);
    try {
      await apiFetch('/api/bins/123');
    } catch (e) {
      const err = e as ApiError;
      expect(err.status).toBe(404);
      expect(err.message).toBe('Bin not found');
    }
  });

  it('falls back to statusText when response.json() fails', async () => {
    const res = mockFetchResponse({ ok: false, status: 500, statusText: 'Internal Server Error' });
    res.json = vi.fn().mockRejectedValue(new Error('not json'));
    fetchSpy.mockResolvedValue(res);

    await expect(apiFetch('/api/fail')).rejects.toThrow(ApiError);
    try {
      await apiFetch('/api/fail');
    } catch (e) {
      const err = e as ApiError;
      expect(err.status).toBe(500);
      expect(err.message).toBe('Internal Server Error');
    }
  });

  it('attempts refresh on 401 and retries original request', async () => {
    const failRes = mockFetchResponse({ ok: false, status: 401, statusText: 'Unauthorized' });
    failRes.json = vi.fn().mockResolvedValue({ error: 'UNAUTHORIZED' });
    const refreshRes = mockFetchResponse({}, '{"message":"Token refreshed"}');
    const successRes = mockFetchResponse({}, '{"id":"1"}');

    fetchSpy
      .mockResolvedValueOnce(failRes)    // original 401
      .mockResolvedValueOnce(refreshRes) // POST /api/auth/refresh
      .mockResolvedValueOnce(successRes); // retry

    const result = await apiFetch('/api/bins/1');
    expect(result).toEqual({ id: '1' });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls[1][0]).toBe('/api/auth/refresh');
  });

  it('dispatches openbin-auth-expired when refresh fails', async () => {
    const failRes = mockFetchResponse({ ok: false, status: 401, statusText: 'Unauthorized' });
    failRes.json = vi.fn().mockResolvedValue({ error: 'UNAUTHORIZED' });
    const refreshFail = mockFetchResponse({ ok: false, status: 401, statusText: 'Unauthorized' });

    fetchSpy
      .mockResolvedValueOnce(failRes)
      .mockResolvedValueOnce(refreshFail);

    const handler = vi.fn();
    window.addEventListener('openbin-auth-expired', handler);

    await expect(apiFetch('/api/bins/1')).rejects.toThrow(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener('openbin-auth-expired', handler);
  });

  it('returns undefined for 204 responses', async () => {
    fetchSpy.mockResolvedValue(mockFetchResponse({ status: 204 }));

    const result = await apiFetch('/api/test', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty text responses', async () => {
    fetchSpy.mockResolvedValue(mockFetchResponse({}, ''));

    const result = await apiFetch('/api/test');
    expect(result).toBeUndefined();
  });

  it('parses and returns valid JSON response', async () => {
    const data = { id: '1', name: 'My Bin', items: ['wrench'] };
    fetchSpy.mockResolvedValue(mockFetchResponse({}, JSON.stringify(data)));

    const result = await apiFetch('/api/bins/1');
    expect(result).toEqual(data);
  });

  it('makes GET request with no body', async () => {
    fetchSpy.mockResolvedValue(mockFetchResponse({}, '[]'));

    await apiFetch('/api/bins');

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/bins');
    expect(init?.body).toBeUndefined();
    const headers = init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });
});

describe('getAvatarUrl', () => {
  it('returns path as-is (cookies handle auth)', () => {
    expect(getAvatarUrl('/api/auth/avatar/user-1')).toBe('/api/auth/avatar/user-1');
  });
});
