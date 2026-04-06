import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { config } from '../../lib/config.js';
import { NotFoundError } from '../../lib/httpErrors.js';
import { metricsLimiter } from '../../lib/rateLimiters.js';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { getCloudMetrics, getPlanBreakdown } from '../metrics.js';

const router = Router();
router.use(authenticate, requireAdmin);

// GET /api/admin/metrics — cloud metrics (cloud mode only)
router.get('/metrics', metricsLimiter, asyncHandler(async (_req, res) => {
  if (config.selfHosted) {
    throw new NotFoundError('Metrics not available in self-hosted mode');
  }
  const metrics = await getCloudMetrics();
  res.json(metrics);
}));

// GET /api/admin/metrics/plan-breakdown
router.get('/metrics/plan-breakdown', metricsLimiter, asyncHandler(async (_req, res) => {
  if (config.selfHosted) {
    throw new NotFoundError('Metrics not available in self-hosted mode');
  }
  const breakdown = await getPlanBreakdown();
  res.json(breakdown);
}));

export { router as adminMetricsRoutes };
