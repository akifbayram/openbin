import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Use dynamic import to get a fresh module per test
describe('qrConfig', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('defaults to app mode before init', async () => {
    const { getQrConfig } = await import('@/lib/qrConfig');
    expect(getQrConfig()).toEqual({ qrPayloadMode: 'app' });
  });

  it('fetches and caches url mode config', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ qrPayloadMode: 'url', baseUrl: 'https://example.com' }),
    });

    const { getQrConfig, initQrConfig } = await import('@/lib/qrConfig');
    await initQrConfig();

    expect(getQrConfig()).toEqual({ qrPayloadMode: 'url', baseUrl: 'https://example.com' });
  });

  it('stays app mode when server returns app', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ qrPayloadMode: 'app' }),
    });

    const { getQrConfig, initQrConfig } = await import('@/lib/qrConfig');
    await initQrConfig();

    expect(getQrConfig()).toEqual({ qrPayloadMode: 'app' });
  });

  it('falls back to app mode on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'));

    const { getQrConfig, initQrConfig } = await import('@/lib/qrConfig');
    await initQrConfig();

    expect(getQrConfig()).toEqual({ qrPayloadMode: 'app' });
  });

  it('falls back to app mode on non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

    const { getQrConfig, initQrConfig } = await import('@/lib/qrConfig');
    await initQrConfig();

    expect(getQrConfig()).toEqual({ qrPayloadMode: 'app' });
  });
});
