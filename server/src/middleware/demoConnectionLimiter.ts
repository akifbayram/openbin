import type { NextFunction, Request, Response } from 'express';
import { config } from '../lib/config.js';
import { DEMO_MEMBERS, DEMO_USERS } from '../lib/demoSeedData.js';

const PER_USER_MAX = 2;
const TOTAL_DEMO_MAX = 6;

const perUserCounts = new Map<string, number>();
let totalDemoCount = 0;

/** Check whether the authenticated user is a demo account. */
export function isDemoUser(req: Request): boolean {
  return config.demoMode && !!req.user && DEMO_MEMBERS.some((m) => DEMO_USERS[m].email === req.user!.email);
}

/**
 * Middleware that limits concurrent in-flight requests for demo users.
 * - Max 2 concurrent requests per demo user
 * - Max 6 concurrent requests across all demo users
 * Non-demo users pass through unaffected.
 */
export function demoConnectionLimiter(req: Request, res: Response, next: NextFunction): void {
  if (!isDemoUser(req)) {
    next();
    return;
  }

  const userId = req.user!.id;
  const currentUser = perUserCounts.get(userId) ?? 0;

  if (currentUser >= PER_USER_MAX || totalDemoCount >= TOTAL_DEMO_MAX) {
    res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many concurrent requests' });
    return;
  }

  perUserCounts.set(userId, currentUser + 1);
  totalDemoCount++;

  let decremented = false;
  const decrement = () => {
    if (decremented) return;
    decremented = true;
    const count = perUserCounts.get(userId) ?? 0;
    if (count <= 1) {
      perUserCounts.delete(userId);
    } else {
      perUserCounts.set(userId, count - 1);
    }
    totalDemoCount = Math.max(0, totalDemoCount - 1);
  };

  res.on('close', decrement);
  next();
}
