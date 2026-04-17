import crypto from 'node:crypto';
import type { Response } from 'express';
import { config } from './config.js';

const ACCESS_COOKIE = 'openbin-access';
const REFRESH_COOKIE = 'openbin-refresh';
export const CSRF_COOKIE = 'openbin-csrf';

const CSRF_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export function setAccessTokenCookie(res: Response, token: string): void {
  res.cookie(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
  // Rotate the CSRF token alongside every access-token issuance.
  // Non-httpOnly so the client can mirror it into the X-CSRF-Token header.
  setCsrfCookie(res);
}

export function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: config.refreshTokenMaxDays * 24 * 60 * 60 * 1000,
  });
}

export function setCsrfCookie(res: Response): string {
  const value = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, value, {
    httpOnly: false,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: CSRF_MAX_AGE,
  });
  return value;
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth/refresh' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}
