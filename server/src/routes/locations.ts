import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { isLocationOwner } from '../middleware/locationAccess.js';

const router = Router();

router.use(authenticate);

function generateInviteCode(): string {
  return crypto.randomBytes(16).toString('hex');
}

// GET /api/locations — list user's locations
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT l.id, l.name, l.created_by, l.invite_code, l.created_at, l.updated_at,
              lm.role,
              (SELECT COUNT(*)::int FROM location_members WHERE location_id = l.id) AS member_count
       FROM locations l
       JOIN location_members lm ON lm.location_id = l.id AND lm.user_id = $1
       ORDER BY l.updated_at DESC`,
      [req.user!.id]
    );

    // Return snake_case to match Location interface (ElectricSQL convention)
    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      created_by: row.created_by,
      invite_code: row.invite_code,
      role: row.role,
      member_count: row.member_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })));
  } catch (err) {
    console.error('List locations error:', err);
    res.status(500).json({ error: 'Failed to list locations' });
  }
});

// POST /api/locations — create location
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Location name is required' });
      return;
    }

    const inviteCode = generateInviteCode();
    const locationResult = await query(
      'INSERT INTO locations (name, created_by, invite_code) VALUES ($1, $2, $3) RETURNING id, name, invite_code, created_at, updated_at',
      [name.trim(), req.user!.id, inviteCode]
    );

    const location = locationResult.rows[0];

    // Auto-add creator as owner
    await query(
      'INSERT INTO location_members (location_id, user_id, role) VALUES ($1, $2, $3)',
      [location.id, req.user!.id, 'owner']
    );

    res.status(201).json({
      id: location.id,
      name: location.name,
      created_by: req.user!.id,
      invite_code: location.invite_code,
      role: 'owner',
      member_count: 1,
      created_at: location.created_at,
      updated_at: location.updated_at,
    });
  } catch (err) {
    console.error('Create location error:', err);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// PUT /api/locations/:id — update location name (owner only)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!await isLocationOwner(id, req.user!.id)) {
      res.status(403).json({ error: 'Only the owner can update this location' });
      return;
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Location name is required' });
      return;
    }

    const result = await query(
      'UPDATE locations SET name = $1, updated_at = now() WHERE id = $2 RETURNING id, name, invite_code, created_at, updated_at',
      [name.trim(), id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    const location = result.rows[0];
    res.json({
      id: location.id,
      name: location.name,
      inviteCode: location.invite_code,
      createdAt: location.created_at,
      updatedAt: location.updated_at,
    });
  } catch (err) {
    console.error('Update location error:', err);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// DELETE /api/locations/:id — delete location (owner only, cascades)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!await isLocationOwner(id, req.user!.id)) {
      res.status(403).json({ error: 'Only the owner can delete this location' });
      return;
    }

    const result = await query('DELETE FROM locations WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    res.json({ message: 'Location deleted' });
  } catch (err) {
    console.error('Delete location error:', err);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

// POST /api/locations/join — join via invite code
router.post('/join', async (req, res) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode || typeof inviteCode !== 'string') {
      res.status(400).json({ error: 'Invite code is required' });
      return;
    }

    const locationResult = await query(
      'SELECT id, name, created_by, created_at, updated_at FROM locations WHERE invite_code = $1',
      [inviteCode.trim()]
    );

    if (locationResult.rows.length === 0) {
      res.status(404).json({ error: 'Invalid invite code' });
      return;
    }

    const location = locationResult.rows[0];

    // Check if already a member
    const existing = await query(
      'SELECT id FROM location_members WHERE location_id = $1 AND user_id = $2',
      [location.id, req.user!.id]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Already a member of this location' });
      return;
    }

    await query(
      'INSERT INTO location_members (location_id, user_id, role) VALUES ($1, $2, $3)',
      [location.id, req.user!.id, 'member']
    );

    res.status(201).json({
      id: location.id,
      name: location.name,
      created_by: location.created_by,
      invite_code: '',
      role: 'member',
      created_at: location.created_at,
      updated_at: location.updated_at,
    });
  } catch (err) {
    console.error('Join location error:', err);
    res.status(500).json({ error: 'Failed to join location' });
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
      res.status(403).json({ error: 'Not a member of this location' });
      return;
    }

    const result = await query(
      `SELECT lm.id, lm.location_id, lm.user_id, lm.role, lm.joined_at
       FROM location_members lm
       WHERE lm.location_id = $1
       ORDER BY lm.joined_at ASC`,
      [locationId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('List members error:', err);
    res.status(500).json({ error: 'Failed to list members' });
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
      res.status(403).json({ error: 'Not a member of this location' });
      return;
    }

    const isOwner = membership.rows[0].role === 'owner';

    // Members can only remove themselves; owners can remove anyone
    if (!isOwner && requesterId !== userId) {
      res.status(403).json({ error: 'Only owners can remove other members' });
      return;
    }

    // Prevent owner from removing themselves (must delete location instead)
    if (isOwner && requesterId === userId) {
      res.status(400).json({ error: 'Owner cannot leave. Delete the location or transfer ownership.' });
      return;
    }

    const result = await query(
      'DELETE FROM location_members WHERE location_id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    res.json({ message: 'Member removed' });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// POST /api/locations/:id/regenerate-invite — new invite code (owner only)
router.post('/:id/regenerate-invite', async (req, res) => {
  try {
    const { id } = req.params;

    if (!await isLocationOwner(id, req.user!.id)) {
      res.status(403).json({ error: 'Only the owner can regenerate invite codes' });
      return;
    }

    const newCode = generateInviteCode();
    const result = await query(
      'UPDATE locations SET invite_code = $1, updated_at = now() WHERE id = $2 RETURNING invite_code',
      [newCode, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    res.json({ inviteCode: result.rows[0].invite_code });
  } catch (err) {
    console.error('Regenerate invite error:', err);
    res.status(500).json({ error: 'Failed to regenerate invite code' });
  }
});

export default router;
