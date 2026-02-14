import { Router } from 'express';
import crypto from 'crypto';
import { query, generateUuid } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { isLocationOwner } from '../middleware/locationAccess.js';
import { logActivity, computeChanges } from '../lib/activityLog.js';

const router = Router();

router.use(authenticate);

function generateInviteCode(): string {
  return crypto.randomBytes(16).toString('hex');
}

// GET /api/locations — list user's locations
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT l.id, l.name, l.created_by, l.invite_code, l.activity_retention_days, l.trash_retention_days, l.created_at, l.updated_at,
              lm.role,
              (SELECT COUNT(*) FROM location_members WHERE location_id = l.id) AS member_count
       FROM locations l
       JOIN location_members lm ON lm.location_id = l.id AND lm.user_id = $1
       ORDER BY l.updated_at DESC`,
      [req.user!.id]
    );

    const locations = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      created_by: row.created_by,
      invite_code: row.invite_code,
      activity_retention_days: row.activity_retention_days,
      trash_retention_days: row.trash_retention_days,
      role: row.role,
      member_count: row.member_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
    res.json({ results: locations, count: locations.length });
  } catch (err) {
    console.error('List locations error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list locations' });
  }
});

// POST /api/locations — create location
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Location name is required' });
      return;
    }

    const inviteCode = generateInviteCode();
    const locationId = generateUuid();
    const locationResult = await query(
      'INSERT INTO locations (id, name, created_by, invite_code) VALUES ($1, $2, $3, $4) RETURNING id, name, invite_code, activity_retention_days, trash_retention_days, created_at, updated_at',
      [locationId, name.trim(), req.user!.id, inviteCode]
    );

    const location = locationResult.rows[0];

    // Auto-add creator as owner
    await query(
      'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [generateUuid(), location.id, req.user!.id, 'owner']
    );

    res.status(201).json({
      id: location.id,
      name: location.name,
      created_by: req.user!.id,
      invite_code: location.invite_code,
      activity_retention_days: location.activity_retention_days,
      trash_retention_days: location.trash_retention_days,
      role: 'owner',
      member_count: 1,
      created_at: location.created_at,
      updated_at: location.updated_at,
    });
  } catch (err) {
    console.error('Create location error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create location' });
  }
});

// PUT /api/locations/:id — update location (owner only)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, activity_retention_days, trash_retention_days } = req.body;

    if (!await isLocationOwner(id, req.user!.id)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Only the owner can update this location' });
      return;
    }

    // At least one field must be provided
    if (name === undefined && activity_retention_days === undefined && trash_retention_days === undefined) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'At least one field must be provided' });
      return;
    }

    if (name !== undefined && (!name || typeof name !== 'string' || name.trim().length === 0)) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Location name cannot be empty' });
      return;
    }

    if (activity_retention_days !== undefined) {
      const v = Number(activity_retention_days);
      if (!Number.isInteger(v) || v < 7 || v > 365) {
        res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Activity retention must be between 7 and 365 days' });
        return;
      }
    }

    if (trash_retention_days !== undefined) {
      const v = Number(trash_retention_days);
      if (!Number.isInteger(v) || v < 7 || v > 365) {
        res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Trash retention must be between 7 and 365 days' });
        return;
      }
    }

    // Get old state for activity log
    const oldResult = await query('SELECT name, activity_retention_days, trash_retention_days FROM locations WHERE id = $1', [id]);
    if (oldResult.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Location not found' });
      return;
    }
    const oldLoc = oldResult.rows[0];

    const setClauses: string[] = [`updated_at = datetime('now')`];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${paramIdx++}`);
      params.push(name.trim());
    }
    if (activity_retention_days !== undefined) {
      setClauses.push(`activity_retention_days = $${paramIdx++}`);
      params.push(Number(activity_retention_days));
    }
    if (trash_retention_days !== undefined) {
      setClauses.push(`trash_retention_days = $${paramIdx++}`);
      params.push(Number(trash_retention_days));
    }

    params.push(id);

    const result = await query(
      `UPDATE locations SET ${setClauses.join(', ')} WHERE id = $${paramIdx}
       RETURNING id, name, created_by, invite_code, activity_retention_days, trash_retention_days, created_at, updated_at`,
      params
    );

    const location = result.rows[0];

    // Log changes
    const newObj: Record<string, unknown> = {};
    if (name !== undefined) newObj.name = name.trim();
    if (activity_retention_days !== undefined) newObj.activity_retention_days = Number(activity_retention_days);
    if (trash_retention_days !== undefined) newObj.trash_retention_days = Number(trash_retention_days);
    const changes = computeChanges(oldLoc, newObj, Object.keys(newObj));
    if (changes) {
      logActivity({
        locationId: id,
        userId: req.user!.id,
        userName: req.user!.username,
        action: 'update',
        entityType: 'location',
        entityId: id,
        entityName: location.name,
        changes,
      });
    }

    res.json({
      id: location.id,
      name: location.name,
      created_by: location.created_by,
      invite_code: location.invite_code,
      activity_retention_days: location.activity_retention_days,
      trash_retention_days: location.trash_retention_days,
      created_at: location.created_at,
      updated_at: location.updated_at,
    });
  } catch (err) {
    console.error('Update location error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update location' });
  }
});

// DELETE /api/locations/:id — delete location (owner only, cascades)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!await isLocationOwner(id, req.user!.id)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Only the owner can delete this location' });
      return;
    }

    const result = await query('DELETE FROM locations WHERE id = $1 RETURNING id, name', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Location not found' });
      return;
    }

    res.json({ message: 'Location deleted' });
  } catch (err) {
    console.error('Delete location error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete location' });
  }
});

// POST /api/locations/join — join via invite code
router.post('/join', async (req, res) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode || typeof inviteCode !== 'string') {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Invite code is required' });
      return;
    }

    const locationResult = await query(
      'SELECT id, name, created_by, activity_retention_days, trash_retention_days, created_at, updated_at FROM locations WHERE invite_code = $1',
      [inviteCode.trim()]
    );

    if (locationResult.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Invalid invite code' });
      return;
    }

    const location = locationResult.rows[0];

    // Check if already a member
    const existing = await query(
      'SELECT id FROM location_members WHERE location_id = $1 AND user_id = $2',
      [location.id, req.user!.id]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'CONFLICT', message: 'Already a member of this location' });
      return;
    }

    await query(
      'INSERT INTO location_members (id, location_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [generateUuid(), location.id, req.user!.id, 'member']
    );

    logActivity({
      locationId: location.id,
      userId: req.user!.id,
      userName: req.user!.username,
      action: 'join',
      entityType: 'member',
      entityName: req.user!.username,
    });

    res.status(201).json({
      id: location.id,
      name: location.name,
      created_by: location.created_by,
      invite_code: '',
      activity_retention_days: location.activity_retention_days,
      trash_retention_days: location.trash_retention_days,
      role: 'member',
      created_at: location.created_at,
      updated_at: location.updated_at,
    });
  } catch (err) {
    console.error('Join location error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to join location' });
  }
});

// GET /api/locations/:id/members — list members
router.get('/:id/members', async (req, res) => {
  try {
    const locationId = req.params.id;

    // Verify requester is a member
    const check = await query(
      'SELECT id FROM location_members WHERE location_id = $1 AND user_id = $2',
      [locationId, req.user!.id]
    );

    if (check.rows.length === 0) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
      return;
    }

    const result = await query(
      `SELECT lm.id, lm.location_id, lm.user_id, lm.role, lm.joined_at,
              COALESCE(u.display_name, u.username) AS display_name
       FROM location_members lm
       LEFT JOIN users u ON u.id = lm.user_id
       WHERE lm.location_id = $1
       ORDER BY lm.joined_at ASC`,
      [locationId]
    );

    res.json({ results: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('List members error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list members' });
  }
});

// DELETE /api/locations/:id/members/:userId — remove member
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params;
    const requesterId = req.user!.id;

    // Check membership
    const membership = await query(
      'SELECT role FROM location_members WHERE location_id = $1 AND user_id = $2',
      [id, requesterId]
    );

    if (membership.rows.length === 0) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
      return;
    }

    const isOwner = membership.rows[0].role === 'owner';

    // Members can only remove themselves; owners can remove anyone
    if (!isOwner && requesterId !== userId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Only owners can remove other members' });
      return;
    }

    // Prevent owner from removing themselves (must delete location instead)
    if (isOwner && requesterId === userId) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Owner cannot leave. Delete the location or transfer ownership.' });
      return;
    }

    // Get username for activity log
    const userResult = await query('SELECT username FROM users WHERE id = $1', [userId]);
    const removedUsername = userResult.rows[0]?.username ?? 'unknown';

    const result = await query(
      'DELETE FROM location_members WHERE location_id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Member not found' });
      return;
    }

    const action = requesterId === userId ? 'leave' : 'remove_member';
    logActivity({
      locationId: id,
      userId: req.user!.id,
      userName: req.user!.username,
      action,
      entityType: 'member',
      entityName: removedUsername,
    });

    res.json({ message: 'Member removed' });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to remove member' });
  }
});

// POST /api/locations/:id/regenerate-invite — new invite code (owner only)
router.post('/:id/regenerate-invite', async (req, res) => {
  try {
    const { id } = req.params;

    if (!await isLocationOwner(id, req.user!.id)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Only the owner can regenerate invite codes' });
      return;
    }

    const newCode = generateInviteCode();
    const result = await query(
      `UPDATE locations SET invite_code = $1, updated_at = datetime('now') WHERE id = $2 RETURNING invite_code`,
      [newCode, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Location not found' });
      return;
    }

    res.json({ inviteCode: result.rows[0].invite_code });
  } catch (err) {
    console.error('Regenerate invite error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to regenerate invite code' });
  }
});

export default router;
