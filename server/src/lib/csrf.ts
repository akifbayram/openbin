import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { CSRF_COOKIE, setCsrfCookie } from './cookies.js';

const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function readCookie(req: Request): string | undefined {
  return req.cookies?.[CSRF_COOKIE] as string | undefined;
}

function readHeader(req: Request): string | undefined {
  const v = req.headers[CSRF_HEADER];
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function hasAuthCookie(req: Request): boolean {
  return !!(req.cookies?.['openbin-access'] || req.cookies?.['openbin-refresh']);
}

function isApiKeyAuth(req: Request): boolean {
  const h = req.headers.authorization;
  return typeof h === 'string' && h.startsWith('Bearer ');
}

// OAuth callback endpoints are exempt — they carry their own CSRF defense via
// the oauth_state cookie + PKCE / nonce, and Apple's POST callback is a
// cross-site form post that cannot carry our X-CSRF-Token header. Without
// this exemption, the link-from-settings flow is blocked for Apple whenever
// the user is already authenticated.
const CSRF_EXEMPT_PREFIXES = ['/api/auth/oauth/'];

/**
 * Double-submit CSRF protection for cookie-authenticated state-changing requests.
 *
 * - Safe methods pass through; lazy-issue the CSRF cookie if a session is present
 *   but the cookie is missing (smooths rollout for already-logged-in users).
 * - Bearer (API key) auth is exempt — bearer tokens cannot be sent cross-origin
 *   by a browser without explicit JS, so they are not CSRF-vulnerable.
 * - Requests with no auth cookies pass through (login, register, refresh,
 *   forgot/reset password) — there is no session to abuse.
 * - All other unsafe-method requests must present X-CSRF-Token matching the
 *   openbin-csrf cookie.
 */
export function csrfProtect(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    if (hasAuthCookie(req) && !readCookie(req)) setCsrfCookie(res);
    next();
    return;
  }

  if (isApiKeyAuth(req) || !hasAuthCookie(req)) {
    next();
    return;
  }

  const path = req.path;
  if (CSRF_EXEMPT_PREFIXES.some((p) => path.startsWith(p))) {
    next();
    return;
  }

  const cookie = readCookie(req);
  const header = readHeader(req);
  if (!cookie || !header || !tokensMatch(cookie, header)) {
    res.status(403).json({ error: 'CSRF_INVALID', message: 'Invalid or missing CSRF token' });
    return;
  }
  next();
}
