import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { isHomeOwner } from '../middleware/homeAccess.js';

const router = Router();

router.use(authenticate);

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString('hex');
}

// GET /api/homes — list user's homes
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT h.id, h.name, h.created_by, h.invite_code, h.created_at, h.updated_at,
              hm.role,
              (SELECT COUNT(*)::int FROM home_members WHERE home_id = h.id) AS member_count
       FROM homes h
       JOIN home_members hm ON hm.home_id = h.id AND hm.user_id = $1
       ORDER BY h.updated_at DESC`,
      [req.user!.id]
    );

    // Return snake_case to match Home interface (ElectricSQL convention)
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
    console.error('List homes error:', err);
    res.status(500).json({ error: 'Failed to list homes' });
  }
});

// POST /api/homes — create home
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Home name is required' });
      return;
    }

    const inviteCode = generateInviteCode();
    const homeResult = await query(
      'INSERT INTO homes (name, created_by, invite_code) VALUES ($1, $2, $3) RETURNING id, name, invite_code, created_at, updated_at',
      [name.trim(), req.user!.id, inviteCode]
    );

    const home = homeResult.rows[0];

    // Auto-add creator as owner
    await query(
      'INSERT INTO home_members (home_id, user_id, role) VALUES ($1, $2, $3)',
      [home.id, req.user!.id, 'owner']
    );

    res.status(201).json({
      id: home.id,
      name: home.name,
      created_by: req.user!.id,
      invite_code: home.invite_code,
      role: 'owner',
      member_count: 1,
      created_at: home.created_at,
      updated_at: home.updated_at,
    });
  } catch (err) {
    console.error('Create home error:', err);
    res.status(500).json({ error: 'Failed to create home' });
  }
});

// PUT /api/homes/:id — update home name (owner only)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!await isHomeOwner(id, req.user!.id)) {
      res.status(403).json({ error: 'Only the owner can update this home' });
      return;
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Home name is required' });
      return;
    }

    const result = await query(
      'UPDATE homes SET name = $1, updated_at = now() WHERE id = $2 RETURNING id, name, invite_code, created_at, updated_at',
      [name.trim(), id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Home not found' });
      return;
    }

    const home = result.rows[0];
    res.json({
      id: home.id,
      name: home.name,
      inviteCode: home.invite_code,
      createdAt: home.created_at,
      updatedAt: home.updated_at,
    });
  } catch (err) {
    console.error('Update home error:', err);
    res.status(500).json({ error: 'Failed to update home' });
  }
});

// DELETE /api/homes/:id — delete home (owner only, cascades)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!await isHomeOwner(id, req.user!.id)) {
      res.status(403).json({ error: 'Only the owner can delete this home' });
      return;
    }

    const result = await query('DELETE FROM homes WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Home not found' });
      return;
    }

    res.json({ message: 'Home deleted' });
  } catch (err) {
    console.error('Delete home error:', err);
    res.status(500).json({ error: 'Failed to delete home' });
  }
});

// POST /api/homes/join — join via invite code
router.post('/join', async (req, res) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode || typeof inviteCode !== 'string') {
      res.status(400).json({ error: 'Invite code is required' });
      return;
    }

    const homeResult = await query(
      'SELECT id, name, created_by, created_at, updated_at FROM homes WHERE invite_code = $1',
      [inviteCode.trim()]
    );

    if (homeResult.rows.length === 0) {
      res.status(404).json({ error: 'Invalid invite code' });
      return;
    }

    const home = homeResult.rows[0];

    // Check if already a member
    const existing = await query(
      'SELECT id FROM home_members WHERE home_id = $1 AND user_id = $2',
      [home.id, req.user!.id]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Already a member of this home' });
      return;
    }

    await query(
      'INSERT INTO home_members (home_id, user_id, role) VALUES ($1, $2, $3)',
      [home.id, req.user!.id, 'member']
    );

    res.status(201).json({
      id: home.id,
      name: home.name,
      created_by: home.created_by,
      invite_code: '',
      role: 'member',
      created_at: home.created_at,
      updated_at: home.updated_at,
    });
  } catch (err) {
    console.error('Join home error:', err);
    res.status(500).json({ error: 'Failed to join home' });
  }
});

// GET /api/homes/:id/members — list members
router.get('/:id/members', async (req, res) => {
  try {
    const homeId = req.params.id;

    // Verify requester is a member
    const check = await query(
      'SELECT id FROM home_members WHERE home_id = $1 AND user_id = $2',
      [homeId, req.user!.id]
    );

    if (check.rows.length === 0) {
      res.status(403).json({ error: 'Not a member of this home' });
      return;
    }

    const result = await query(
      `SELECT hm.id, hm.home_id, hm.user_id, hm.role, hm.joined_at
       FROM home_members hm
       WHERE hm.home_id = $1
       ORDER BY hm.joined_at ASC`,
      [homeId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('List members error:', err);
    res.status(500).json({ error: 'Failed to list members' });
  }
});

// DELETE /api/homes/:id/members/:userId — remove member
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params;
    const requesterId = req.user!.id;

    // Check membership
    const membership = await query(
      'SELECT role FROM home_members WHERE home_id = $1 AND user_id = $2',
      [id, requesterId]
    );

    if (membership.rows.length === 0) {
      res.status(403).json({ error: 'Not a member of this home' });
      return;
    }

    const isOwner = membership.rows[0].role === 'owner';

    // Members can only remove themselves; owners can remove anyone
    if (!isOwner && requesterId !== userId) {
      res.status(403).json({ error: 'Only owners can remove other members' });
      return;
    }

    // Prevent owner from removing themselves (must delete home instead)
    if (isOwner && requesterId === userId) {
      res.status(400).json({ error: 'Owner cannot leave. Delete the home or transfer ownership.' });
      return;
    }

    const result = await query(
      'DELETE FROM home_members WHERE home_id = $1 AND user_id = $2 RETURNING id',
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

// POST /api/homes/:id/regenerate-invite — new invite code (owner only)
router.post('/:id/regenerate-invite', async (req, res) => {
  try {
    const { id } = req.params;

    if (!await isHomeOwner(id, req.user!.id)) {
      res.status(403).json({ error: 'Only the owner can regenerate invite codes' });
      return;
    }

    const newCode = generateInviteCode();
    const result = await query(
      'UPDATE homes SET invite_code = $1, updated_at = now() WHERE id = $2 RETURNING invite_code',
      [newCode, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Home not found' });
      return;
    }

    res.json({ inviteCode: result.rows[0].invite_code });
  } catch (err) {
    console.error('Regenerate invite error:', err);
    res.status(500).json({ error: 'Failed to regenerate invite code' });
  }
});

export default router;
