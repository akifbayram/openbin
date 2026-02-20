import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

router.use(authenticate);

// GET /api/locations/:locationId/activity — get activity log for a location
router.get('/:locationId/activity', requireLocationMember('locationId'), asyncHandler(async (req, res) => {
  const { locationId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const entityType = req.query.entity_type as string | undefined;
  const entityId = req.query.entity_id as string | undefined;

  let whereClause = 'WHERE al.location_id = $1';
  const params: unknown[] = [locationId];
  let paramIdx = 2;

  if (entityType) {
    whereClause += ` AND al.entity_type = $${paramIdx++}`;
    params.push(entityType);
  }
  if (entityId) {
    whereClause += ` AND al.entity_id = $${paramIdx++}`;
    params.push(entityId);
  }

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) AS count FROM activity_log al ${whereClause}`,
    params
  );
  const count = countResult.rows[0].count;

  // Get paginated results with optional display_name from users
  const result = await query(
    `SELECT al.id, al.location_id, al.user_id, al.user_name,
            COALESCE(u.display_name, al.user_name) AS display_name,
            al.action, al.entity_type, al.entity_id, al.entity_name,
            al.changes, al.auth_method, al.created_at
     FROM activity_log al
     LEFT JOIN users u ON u.id = al.user_id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
    [...params, limit, offset]
  );

  res.json({ results: result.rows, count });
}));

export default router;
