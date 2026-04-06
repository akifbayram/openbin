import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { metricsLimiter } from '../../lib/rateLimiters.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { getCloudMetrics, getPlanBreakdown } from '../metrics.js';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/metrics', metricsLimiter, asyncHandler(async (_req, res) => {
  const metrics = await getCloudMetrics();
  res.json(metrics);
}));

router.get('/metrics/plan-breakdown', metricsLimiter, asyncHandler(async (_req, res) => {
  const breakdown = await getPlanBreakdown();
  res.json(breakdown);
}));

export { router as adminMetricsRoutes };
