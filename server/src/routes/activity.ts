import { Router } from 'express';
import { d, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getUserFeatures } from '../lib/planGate.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';

const router = Router();

router.use(authenticate);

// GET /api/locations/:locationId/activity — get activity log for a location
router.get('/:locationId/activity', requireLocationMember('locationId'), asyncHandler(async (req, res) => {
  const { locationId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const entityType = req.query.entity_type as string | undefined;
  const entityId = req.query.entity_id as string | undefined;
  const userId = req.query.user_id as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  let whereClause = 'WHERE al.location_id = $1';
  const params: unknown[] = [locationId];
  let paramIdx = 2;

  const features = await getUserFeatures(req.user!.id);
  if (features.activityRetentionDays !== null) {
    whereClause += ` AND al.created_at >= ${d.intervalDaysAgo(String(features.activityRetentionDays))}`;
  }

  if (entityType) {
    whereClause += ` AND al.entity_type = $${paramIdx++}`;
    params.push(entityType);
  }
  if (entityId) {
    whereClause += ` AND al.entity_id = $${paramIdx++}`;
    params.push(entityId);
  }
  if (userId) {
    whereClause += ` AND al.user_id = $${paramIdx++}`;
    params.push(userId);
  }
  if (from) {
    whereClause += ` AND al.created_at >= $${paramIdx++}`;
    params.push(from);
  }
  if (to) {
    whereClause += ` AND al.created_at < $${paramIdx++}`;
    params.push(to);
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) AS count FROM activity_log al ${whereClause}`,
    params
  );
  const count = countResult.rows[0].count;

  // Get paginated results with optional display_name from users and api key name
  const result = await query(
    `SELECT al.id, al.location_id, al.user_id, al.user_name,
            COALESCE(u.display_name, al.user_name) AS display_name,
            al.action, al.entity_type, al.entity_id, al.entity_name,
            al.changes, al.auth_method, al.api_key_id, ak.name AS api_key_name,
            al.created_at
     FROM activity_log al
     LEFT JOIN users u ON u.id = al.user_id
     LEFT JOIN api_keys ak ON ak.id = al.api_key_id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
    [...params, limit, offset]
  );

  res.json({ results: result.rows, count });
}));

export default router;
