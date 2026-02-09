import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { authenticate, signToken } from '../middleware/auth.js';

const router = Router();

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,50}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;
const AVATAR_STORAGE_PATH = path.join(process.env.PHOTO_STORAGE_PATH || './uploads', 'avatars');

const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(AVATAR_STORAGE_PATH, { recursive: true });
    cb(null, AVATAR_STORAGE_PATH);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (AVATAR_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

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
        email: null,
        avatarUrl: null,
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
      'SELECT id, username, password_hash, display_name, email, avatar_path FROM users WHERE username = $1',
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
        email: user.email || null,
        avatarUrl: user.avatar_path ? `/api/auth/avatar/${user.id}` : null,
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
      'SELECT id, username, display_name, email, avatar_path, created_at, updated_at FROM users WHERE id = $1',
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
      email: user.email || null,
      avatarUrl: user.avatar_path ? `/api/auth/avatar/${user.id}` : null,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/auth/profile — update display name and/or email
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { displayName, email } = req.body;

    if (displayName !== undefined) {
      const trimmed = String(displayName).trim();
      if (trimmed.length < 1 || trimmed.length > 100) {
        res.status(400).json({ error: 'Display name must be 1-100 characters' });
        return;
      }
    }

    if (email !== undefined && email !== null && email !== '') {
      if (!EMAIL_REGEX.test(email) || email.length > 255) {
        res.status(400).json({ error: 'Invalid email address' });
        return;
      }
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (displayName !== undefined) {
      updates.push(`display_name = $${idx++}`);
      values.push(String(displayName).trim());
    }
    if (email !== undefined) {
      updates.push(`email = $${idx++}`);
      values.push(email === '' ? null : email);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push(`updated_at = now()`);
    values.push(req.user!.id);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, username, display_name, email, avatar_path, created_at, updated_at`,
      values
    );

    const user = result.rows[0];
    res.json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      email: user.email || null,
      avatarUrl: user.avatar_path ? `/api/auth/avatar/${user.id}` : null,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PUT /api/auth/password — change password
router.put('/password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters' });
      return;
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [newHash, req.user!.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// POST /api/auth/avatar — upload avatar
router.post('/avatar', authenticate, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Delete old avatar file if exists
    const existing = await query('SELECT avatar_path FROM users WHERE id = $1', [req.user!.id]);
    if (existing.rows[0]?.avatar_path) {
      const oldPath = existing.rows[0].avatar_path;
      try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
    }

    const storagePath = req.file.path;
    await query('UPDATE users SET avatar_path = $1, updated_at = now() WHERE id = $2', [storagePath, req.user!.id]);

    res.json({ avatarUrl: `/api/auth/avatar/${req.user!.id}` });
  } catch (err) {
    console.error('Upload avatar error:', err);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// DELETE /api/auth/avatar — remove avatar
router.delete('/avatar', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT avatar_path FROM users WHERE id = $1', [req.user!.id]);
    const avatarPath = result.rows[0]?.avatar_path;

    if (avatarPath) {
      try { fs.unlinkSync(avatarPath); } catch { /* ignore */ }
    }

    await query('UPDATE users SET avatar_path = NULL, updated_at = now() WHERE id = $1', [req.user!.id]);

    res.json({ message: 'Avatar removed' });
  } catch (err) {
    console.error('Remove avatar error:', err);
    res.status(500).json({ error: 'Failed to remove avatar' });
  }
});

// GET /api/auth/avatar/:userId — serve avatar file
router.get('/avatar/:userId', async (req, res) => {
  try {
    const result = await query('SELECT avatar_path FROM users WHERE id = $1', [req.params.userId]);
    const avatarPath = result.rows[0]?.avatar_path;

    if (!avatarPath) {
      res.status(404).json({ error: 'No avatar found' });
      return;
    }

    if (!fs.existsSync(avatarPath)) {
      res.status(404).json({ error: 'Avatar file not found' });
      return;
    }

    const ext = path.extname(avatarPath).toLowerCase();
    const mimeMap: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
    res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fs.createReadStream(avatarPath).pipe(res);
  } catch (err) {
    console.error('Serve avatar error:', err);
    res.status(500).json({ error: 'Failed to serve avatar' });
  }
});

export default router;
