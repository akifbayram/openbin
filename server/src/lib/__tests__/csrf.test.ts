import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../cookies.js', () => ({
  CSRF_COOKIE: 'openbin-csrf',
  setCsrfCookie: vi.fn(),
}));

import { setCsrfCookie } from '../cookies.js';
import { csrfProtect } from '../csrf.js';

function makeReq(overrides: Partial<{
  method: string;
  path: string;
  cookies: Record<string, string>;
  headers: Record<string, string>;
}>): Request {
  return {
    method: overrides.method ?? 'POST',
    path: overrides.path ?? '/api/bins',
    cookies: overrides.cookies ?? {},
    headers: overrides.headers ?? {},
  } as unknown as Request;
}

function makeRes(): Response {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
}

describe('csrfProtect', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
    vi.mocked(setCsrfCookie).mockReset();
  });

  it('safe methods pass through without a session cookie', () => {
    const req = makeReq({ method: 'GET', cookies: {} });
    csrfProtect(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('safe method with auth cookie but no CSRF cookie lazily issues the CSRF cookie', () => {
    const req = makeReq({ method: 'GET', cookies: { 'openbin-access': 'token' } });
    const res = makeRes();
    csrfProtect(req, res, next);
    expect(setCsrfCookie).toHaveBeenCalledWith(res);
    expect(next).toHaveBeenCalledOnce();
  });

  it('unsafe method with Bearer auth skips CSRF check', () => {
    const req = makeReq({
      method: 'POST',
      cookies: { 'openbin-access': 'session' },
      headers: { authorization: 'Bearer sk_openbin_abc' },
    });
    csrfProtect(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('unsafe method with no auth cookies passes through (login, register)', () => {
    const req = makeReq({ method: 'POST', cookies: {} });
    csrfProtect(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('unsafe method with auth cookies and matching CSRF token passes', () => {
    const token = 'abc123';
    const req = makeReq({
      method: 'POST',
      cookies: { 'openbin-access': 'session', 'openbin-csrf': token },
      headers: { 'x-csrf-token': token },
    });
    csrfProtect(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('OAuth callback paths are exempt from CSRF check', () => {
    const req = makeReq({
      method: 'POST',
      path: '/api/auth/oauth/apple/callback',
      cookies: { 'openbin-access': 'session' },
      headers: {},
    });
    csrfProtect(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('unsafe method with auth cookies and mismatched CSRF token returns 403', () => {
    const req = makeReq({
      method: 'DELETE',
      cookies: { 'openbin-access': 'session', 'openbin-csrf': 'correct' },
      headers: { 'x-csrf-token': 'wrong' },
    });
    const res = makeRes();
    csrfProtect(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'CSRF_INVALID' }));
  });

  it('unsafe method with auth cookies and missing CSRF header returns 403', () => {
    const req = makeReq({
      method: 'PUT',
      cookies: { 'openbin-access': 'session', 'openbin-csrf': 'abc' },
      headers: {},
    });
    const res = makeRes();
    csrfProtect(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
