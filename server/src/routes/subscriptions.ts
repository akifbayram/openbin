import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { config } from '../lib/config.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../lib/httpErrors.js';
import { invalidateOverLimitCache, Plan, SubStatus } from '../lib/planGate.js';
import { invalidatePlanRateLimit } from '../lib/rateLimiters.js';

const router = Router();

const validPlans = new Set(Object.values(Plan));
const validStatuses = new Set(Object.values(SubStatus));

router.post('/callback', asyncHandler(async (req, res) => {
  if (config.selfHosted) {
    throw new NotFoundError('Not available in self-hosted mode');
  }

  const secret = config.subscriptionWebhookSecret;
  if (!secret) {
    res.status(503).json({ error: 'SERVICE_NOT_CONFIGURED', message: 'Subscription webhook secret not configured' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing authorization token');
  }

  const token = authHeader.slice(7);

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

  const prevRow = await query<{ sub_status: number }>('SELECT sub_status FROM users WHERE id = $1', [userId]);
  const previousSubStatus = prevRow.rows[0]?.sub_status ?? null;

  const result = await query(
    'UPDATE users SET plan = $1, sub_status = $2, active_until = $3, previous_sub_status = $4, updated_at = datetime(\'now\') WHERE id = $5',
    [plan, status, activeUntil || null, status === SubStatus.INACTIVE ? previousSubStatus : null, userId],
  );

  if (result.rowCount === 0) {
    throw new NotFoundError('User not found');
  }

  invalidatePlanRateLimit(userId);
  invalidateOverLimitCache(userId);

  res.json({ ok: true });

  // Fire-and-forget subscription lifecycle emails
  const userRow = (await query('SELECT email, display_name FROM users WHERE id = $1', [userId])).rows[0];
  if (userRow?.email) {
    const { fireSubscriptionConfirmedEmail, fireSubscriptionExpiredEmail } = await import('../lib/emailSender.js');
    if (status === SubStatus.ACTIVE) {
      fireSubscriptionConfirmedEmail(userId, userRow.email, userRow.display_name, plan as import('../lib/planGate.js').PlanTier, activeUntil);
    } else if (status === SubStatus.INACTIVE) {
      fireSubscriptionExpiredEmail(userId, userRow.email, userRow.display_name);
    }
    if (plan === Plan.LITE && previousSubStatus !== null) {
      const { fireDowngradeImpactEmail } = await import('../lib/emailSender.js');
      const [locRes, photoRes, memberRes] = await Promise.all([
        query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM locations WHERE created_by = $1', [userId]),
        query<{ total: number }>('SELECT COALESCE(SUM(size), 0) as total FROM photos WHERE created_by = $1', [userId]),
        query<{ location_id: string; name: string; cnt: number }>(
          `SELECT lm.location_id, l.name, COUNT(*) as cnt
           FROM location_members lm JOIN locations l ON l.id = lm.location_id
           WHERE lm.location_id IN (SELECT id FROM locations WHERE created_by = $1)
           GROUP BY lm.location_id`,
          [userId],
        ),
      ]);
      const liteFeatures = (await import('../lib/planGate.js')).getFeatureMap(Plan.LITE);
      const impact = {
        locationCount: locRes.rows[0].cnt,
        maxLocations: liteFeatures.maxLocations ?? 1,
        photoStorageMb: Math.round((photoRes.rows[0].total / (1024 * 1024)) * 100) / 100,
        maxPhotoStorageMb: liteFeatures.maxPhotoStorageMb ?? 100,
        overLimitMembers: memberRes.rows
          .filter(r => liteFeatures.maxMembersPerLocation !== null && r.cnt > liteFeatures.maxMembersPerLocation)
          .map(r => ({ locationName: r.name, memberCount: r.cnt })),
        maxMembersPerLocation: liteFeatures.maxMembersPerLocation ?? 1,
      };
      fireDowngradeImpactEmail(userId, userRow.email, userRow.display_name, impact);
    }
  }
}));

export { router as subscriptionsRoutes };
