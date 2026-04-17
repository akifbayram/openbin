import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { DEMO_MEMBERS, DEMO_USERS } from './demoSeedData.js';

const noop: RequestHandler = (_req, _res, next) => next();
const isTest = config.disableRateLimit;

const DEMO_EMAILS = new Set(DEMO_MEMBERS.map((m) => DEMO_USERS[m].email));

export const authLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many attempts, please try again later' },
});

export const registerLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many registration attempts, please try again later' },
});

export const joinLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many attempts, please try again later' },
});

export const sensitiveAuthLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many attempts, please try again later' },
});

export const apiLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  // Requires tryAuthenticate to run first so req.user is populated; demo users stay capped.
  skip: (req) => {
    if (config.selfHosted) return true;
    if (!req.user) return false;
    return !(config.demoMode && DEMO_EMAILS.has(req.user.email));
  },
  message: { error: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
});

export const metricsLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
});


export const importLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many import attempts, please try again later' },
});

export { aiRateLimiters } from './aiRateLimiter.js';
