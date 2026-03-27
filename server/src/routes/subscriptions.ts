import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { config } from '../lib/config.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../lib/httpErrors.js';
import { Plan, SubStatus } from '../lib/planGate.js';

const router = Router();

const validPlans = new Set(Object.values(Plan));
const validStatuses = new Set(Object.values(SubStatus));

router.post('/callback', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing authorization token');
  }

  const token = authHeader.slice(7);
  const secret = config.subscriptionJwtSecret;
  if (!secret) {
    throw new UnauthorizedError('Subscription JWT secret not configured');
  }

  let payload: { userId: string; plan: number; status: number; activeUntil: string };
  try {
    payload = jwt.verify(token, secret) as typeof payload;
  } catch {
    throw new UnauthorizedError('Invalid subscription token');
  }

  const { userId, plan, status, activeUntil } = payload;
  if (!userId || typeof plan !== 'number' || typeof status !== 'number') {
    throw new ValidationError('Invalid callback payload');
  }
  if (!validPlans.has(plan as (typeof Plan)[keyof typeof Plan])) {
    throw new ValidationError('Invalid plan value');
  }
  if (!validStatuses.has(status as (typeof SubStatus)[keyof typeof SubStatus])) {
    throw new ValidationError('Invalid status value');
  }

  const result = await query(
    'UPDATE users SET plan = $1, sub_status = $2, active_until = $3, updated_at = datetime(\'now\') WHERE id = $4',
    [plan, status, activeUntil || null, userId],
  );

  if (result.rowCount === 0) {
    throw new NotFoundError('User not found');
  }

  res.json({ ok: true });
}));

export { router as subscriptionsRoutes };
