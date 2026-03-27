import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { config } from '../lib/config.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../lib/httpErrors.js';

const router = Router();

// POST /api/subscriptions/callback
router.post('/callback', asyncHandler(async (req, res) => {
  // Verify JWT from Authorization header
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

  // Validate payload
  const { userId, plan, status, activeUntil } = payload;
  if (!userId || typeof plan !== 'number' || typeof status !== 'number') {
    throw new ValidationError('Invalid callback payload');
  }
  if (plan !== 0 && plan !== 1) {
    throw new ValidationError('Invalid plan value');
  }
  if (status !== 0 && status !== 1 && status !== 2) {
    throw new ValidationError('Invalid status value');
  }

  // Update user record
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
