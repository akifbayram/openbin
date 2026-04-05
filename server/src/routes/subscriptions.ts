import { Router } from 'express';
import * as jose from 'jose';
import { d, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { config } from '../lib/config.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../lib/httpErrors.js';
import { createLogger } from '../lib/logger.js';
import { invalidateOverLimitCache, Plan, type PlanTier, SubStatus, type SubStatusType, validatePlanTransition } from '../lib/planGate.js';

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

  let payload: { userId: string; plan: number; status: number; activeUntil: string; updatedAt?: string };
  try {
    const result = await jose.jwtVerify(token, new TextEncoder().encode(secret));
    payload = result.payload as unknown as typeof payload;
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
  if (!validatePlanTransition(plan as PlanTier, status as SubStatusType)) {
    throw new ValidationError('Invalid plan/status combination: TRIAL is only valid for PLUS');
  }

  // Reject stale webhooks if updatedAt is provided
  if (payload.updatedAt && typeof payload.updatedAt === 'string') {
    const current = await query<{ updated_at: string }>(
      'SELECT updated_at FROM users WHERE id = $1',
      [userId],
    );
    if (current.rows.length > 0 && current.rows[0].updated_at > payload.updatedAt) {
      createLogger('subscriptions').warn(`Stale webhook for user ${userId}: incoming ${payload.updatedAt} < current ${current.rows[0].updated_at}`);
      res.json({ ok: true, stale: true });
      return;
    }
  }

  const prevRow = await query<{ plan: number; sub_status: number }>('SELECT plan, sub_status FROM users WHERE id = $1', [userId]);
  const wasPro = prevRow.rows[0]?.plan === Plan.PRO;

  const result = await query(
    `UPDATE users SET plan = $1, sub_status = $2, active_until = $3,
     previous_sub_status = CASE WHEN $2 = ${SubStatus.INACTIVE} THEN sub_status ELSE NULL END,
     updated_at = ${d.now()} WHERE id = $4`,
    [plan, status, activeUntil || null, userId],
  );

  if (result.rowCount === 0) {
    throw new NotFoundError('User not found');
  }

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
    if (plan === Plan.PLUS && wasPro) {
      const { fireDowngradeImpactEmail } = await import('../lib/emailSender.js');
      const [locRes, photoRes, memberRes] = await Promise.all([
        query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM locations WHERE created_by = $1', [userId]),
        query<{ total: number }>('SELECT COALESCE(SUM(size), 0) as total FROM photos WHERE created_by = $1', [userId]),
        query<{ location_id: string; name: string; cnt: number }>(
          `SELECT lm.location_id, l.name, COUNT(*) as cnt
           FROM location_members lm JOIN locations l ON l.id = lm.location_id
           WHERE lm.location_id IN (SELECT id FROM locations WHERE created_by = $1)
           GROUP BY lm.location_id, l.name`,
          [userId],
        ),
      ]);
      const plusFeatures = (await import('../lib/planGate.js')).getFeatureMap(Plan.PLUS);
      const impact = {
        locationCount: locRes.rows[0].cnt,
        maxLocations: plusFeatures.maxLocations ?? 1,
        photoStorageMb: Math.round((photoRes.rows[0].total / (1024 * 1024)) * 100) / 100,
        maxPhotoStorageMb: plusFeatures.maxPhotoStorageMb ?? 100,
        overLimitMembers: memberRes.rows
          .filter(r => plusFeatures.maxMembersPerLocation !== null && r.cnt > plusFeatures.maxMembersPerLocation)
          .map(r => ({ locationName: r.name, memberCount: r.cnt })),
        maxMembersPerLocation: plusFeatures.maxMembersPerLocation ?? 1,
      };
      fireDowngradeImpactEmail(userId, userRow.email, userRow.display_name, impact);
    }
  }
}));

export { router as subscriptionsRoutes };
