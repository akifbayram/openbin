import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

function parseCookies(res: request.Response): Record<string, string> {
  const out: Record<string, string> = {};
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return out;
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of arr) {
    const [nameVal] = c.split(';');
    const [name, ...rest] = nameVal.split('=');
    out[name.trim()] = rest.join('=');
  }
  return out;
}

async function loginViaCookie(): Promise<{ access: string; refresh: string; csrf: string; userId: string }> {
  const { user, password } = await createTestUser(app);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password });
  expect(res.status).toBe(200);
  const cookies = parseCookies(res);
  return {
    access: cookies['openbin-access'],
    refresh: cookies['openbin-refresh'],
    csrf: cookies['openbin-csrf'],
    userId: user.id,
  };
}

describe('CSRF protection', () => {
  it('issues a non-httpOnly openbin-csrf cookie on login', async () => {
    const { user, password } = await createTestUser(app);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password });
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const csrfHeader = setCookie.find((c) => c.startsWith('openbin-csrf='));
    expect(csrfHeader).toBeDefined();
    expect(csrfHeader).not.toMatch(/HttpOnly/i);
    expect(csrfHeader).toMatch(/SameSite=Lax/i);
    expect(csrfHeader).toMatch(/Path=\//);
  });

  it('rejects cookie-auth POST without X-CSRF-Token header', async () => {
    const { access, refresh, csrf } = await loginViaCookie();
    const res = await request(app)
      .post('/api/locations')
      .set('Cookie', [`openbin-access=${access}`, `openbin-refresh=${refresh}`, `openbin-csrf=${csrf}`])
      .send({ name: 'Forbidden Location' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CSRF_INVALID');
  });

  it('rejects cookie-auth POST with mismatched X-CSRF-Token', async () => {
    const { access, refresh, csrf } = await loginViaCookie();
    const res = await request(app)
      .post('/api/locations')
      .set('Cookie', [`openbin-access=${access}`, `openbin-refresh=${refresh}`, `openbin-csrf=${csrf}`])
      .set('X-CSRF-Token', 'wrong-token-of-different-length-here')
      .send({ name: 'Forbidden Location' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CSRF_INVALID');
  });

  it('accepts cookie-auth POST with matching X-CSRF-Token', async () => {
    const { access, refresh, csrf } = await loginViaCookie();
    const res = await request(app)
      .post('/api/locations')
      .set('Cookie', [`openbin-access=${access}`, `openbin-refresh=${refresh}`, `openbin-csrf=${csrf}`])
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Allowed Location' });
    expect(res.status).toBe(201);
  });

  it('exempts Bearer (API key) auth from CSRF', async () => {
    const { token } = await createTestUser(app);
    // Bearer with JWT — header path bypasses CSRF entirely
    const res = await request(app)
      .post('/api/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bearer Location' });
    expect(res.status).toBe(201);
  });

  it('lets unauthenticated POSTs through (login, register, forgot-password)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noone@test.local', password: 'whatever' });
    // No CSRF cookies present → middleware passes through; route returns 401 for bad creds
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('requires CSRF on /api/auth/refresh when refresh cookie is present', async () => {
    const { refresh, csrf } = await loginViaCookie();
    const noHeader = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`openbin-refresh=${refresh}`, `openbin-csrf=${csrf}`]);
    expect(noHeader.status).toBe(403);
    expect(noHeader.body.error).toBe('CSRF_INVALID');

    const withHeader = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`openbin-refresh=${refresh}`, `openbin-csrf=${csrf}`])
      .set('X-CSRF-Token', csrf);
    expect(withHeader.status).toBe(200);
  });

  it('requires CSRF on logout when cookies are present', async () => {
    const { access, refresh, csrf } = await loginViaCookie();
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`openbin-access=${access}`, `openbin-refresh=${refresh}`, `openbin-csrf=${csrf}`]);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CSRF_INVALID');
  });

  it('lazy-issues CSRF cookie on a safe-method request when session exists but cookie is missing', async () => {
    const { access, refresh } = await loginViaCookie();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`openbin-access=${access}`, `openbin-refresh=${refresh}`]);
    expect(res.status).toBe(200);
    const setCookie = (res.headers['set-cookie'] as unknown as string[]) || [];
    expect(setCookie.some((c) => c.startsWith('openbin-csrf='))).toBe(true);
  });

  it('allows GET requests without CSRF check even when cookies are present', async () => {
    const { access, refresh } = await loginViaCookie();
    const res = await request(app)
      .get('/api/locations')
      .set('Cookie', [`openbin-access=${access}`, `openbin-refresh=${refresh}`]);
    expect(res.status).toBe(200);
  });
});
