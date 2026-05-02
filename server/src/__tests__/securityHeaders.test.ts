import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';

let csp: string;
let xFrameOptions: string | undefined;
let xContentTypeOptions: string | undefined;

beforeAll(async () => {
  const res = await request(createApp()).get('/api/auth/status');
  csp = res.headers['content-security-policy'];
  xFrameOptions = res.headers['x-frame-options'];
  xContentTypeOptions = res.headers['x-content-type-options'];
});

describe('Security headers', () => {
  it('serves a CSP that locks the app down to self + pinned inline scripts', () => {
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    // Loosening these hashes would allow arbitrary inline scripts.
    expect(csp).toContain("'sha256-7KadoKzu1sd1+0LivMFrmxISBXbhj6nm/vOZqEaVC5I='");
    expect(csp).toContain("'sha256-4kldY8Nv9iluY61Doo0WCNi1p1qCWgXWfSgXIX8g3g0='");
    expect(csp).toMatch(/frame-ancestors/);
  });

  it('allows the Cloudflare Web Analytics beacon (script + reporting endpoint)', () => {
    // CF auto-injects the RUM beacon at the proxy layer when Web Analytics is enabled.
    // Without these allowances the browser logs a CSP violation on every pageload.
    expect(csp).toMatch(/script-src[^;]*https:\/\/static\.cloudflareinsights\.com/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/cloudflareinsights\.com/);
  });

  it('sets the supporting headers (X-Content-Type-Options, X-Frame-Options)', () => {
    expect(xContentTypeOptions).toBe('nosniff');
    expect(xFrameOptions).toBeDefined();
  });
});
