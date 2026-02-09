import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../db.js';
import { authenticate, signToken } from '../middleware/auth.js';

const router = Router();

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,50}$/;
const BCRYPT_ROUNDS = 12;

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password, displayName } = req.body;

    if (!username || !USERNAME_REGEX.test(username)) {
      res.status(400).json({ error: 'Username must be 3-50 characters (alphanumeric and underscores only)' });
      return;
    }
    if (!password || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const existing = await query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await query(
      'INSERT INTO users (username, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, username, display_name, created_at',
      [username.toLowerCase(), passwordHash, displayName || username]
    );

    const user = result.rows[0];
    const token = signToken({ id: user.id, username: user.username });

    // Auto-create default home for the new user
    const inviteCode = crypto.randomBytes(4).toString('hex');
    const homeResult = await query(
      'INSERT INTO homes (name, created_by, invite_code) VALUES ($1, $2, $3) RETURNING id',
      ['My Home', user.id, inviteCode]
    );
    const homeId = homeResult.rows[0].id;
    await query(
      'INSERT INTO home_members (home_id, user_id, role) VALUES ($1, $2, $3)',
      [homeId, user.id, 'owner']
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        createdAt: user.created_at,
      },
      activeHomeId: homeId,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }

    const result = await query(
      'SELECT id, username, password_hash, display_name FROM users WHERE username = $1',
      [username.toLowerCase()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const token = signToken({ id: user.id, username: user.username });

    // Fetch user's first home for auto-selection
    const homesResult = await query(
      `SELECT h.id FROM homes h
       JOIN home_members hm ON hm.home_id = h.id AND hm.user_id = $1
       ORDER BY h.updated_at DESC LIMIT 1`,
      [user.id]
    );
    const activeHomeId = homesResult.rows.length > 0 ? homesResult.rows[0].id : null;

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
      },
      activeHomeId,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, username, display_name, created_at, updated_at FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
