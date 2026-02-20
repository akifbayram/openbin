import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { config } from './config.js';

const noop: RequestHandler = (_req, _res, next) => next();
const isTest = config.disableRateLimit;

export const authLimiter: RequestHandler = isTest ? noop : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
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
