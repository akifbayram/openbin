import { Router } from 'express';
import bcrypt from 'bcrypt';
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
const MIME_TO_EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

function isPathSafe(filePath: string, baseDir: string): boolean {
  const resolved = path.resolve(filePath);
  return resolved.startsWith(path.resolve(baseDir) + path.sep) || resolved === path.resolve(baseDir);
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(AVATAR_STORAGE_PATH, { recursive: true });
    cb(null, AVATAR_STORAGE_PATH);
  },
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || '.jpg';
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
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Username must be 3-50 characters (alphanumeric and underscores only)' });
      return;
    }
    if (!password || !isStrongPassword(password)) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters with uppercase, lowercase, and a number' });
      return;
    }

    const existing = await query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'CONFLICT', message: 'Username already taken' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await query(
      'INSERT INTO users (username, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, username, display_name, created_at',
      [username.toLowerCase(), passwordHash, displayName || username]
    );

    const user = result.rows[0];
    const token = signToken({ id: user.id, username: user.username });

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
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Username and password required' });
      return;
    }

    const result = await query(
      'SELECT id, username, password_hash, display_name, email, avatar_path FROM users WHERE username = $1',
      [username.toLowerCase()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid username or password' });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid username or password' });
      return;
    }

    const token = signToken({ id: user.id, username: user.username });

    // Fetch user's first location for auto-selection
    const locationsResult = await query(
      `SELECT l.id FROM locations l
       JOIN location_members lm ON lm.location_id = l.id AND lm.user_id = $1
       ORDER BY l.updated_at DESC LIMIT 1`,
      [user.id]
    );
    const activeLocationId = locationsResult.rows.length > 0 ? locationsResult.rows[0].id : null;

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email || null,
        avatarUrl: user.avatar_path ? `/api/auth/avatar/${user.id}` : null,
      },
      activeLocationId,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Login failed' });
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
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
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
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch profile' });
  }
});

// PUT /api/auth/profile — update display name and/or email
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { displayName, email } = req.body;

    if (displayName !== undefined) {
      const trimmed = String(displayName).trim();
      if (trimmed.length < 1 || trimmed.length > 100) {
        res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Display name must be 1-100 characters' });
        return;
      }
    }

    if (email !== undefined && email !== null && email !== '') {
      if (!EMAIL_REGEX.test(email) || email.length > 255) {
        res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Invalid email address' });
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
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'No fields to update' });
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
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update profile' });
  }
});

// PUT /api/auth/password — change password
router.put('/password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Current password and new password are required' });
      return;
    }
    if (!isStrongPassword(newPassword)) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters with uppercase, lowercase, and a number' });
      return;
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [newHash, req.user!.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to change password' });
  }
});

// POST /api/auth/avatar — upload avatar
router.post('/avatar', authenticate, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'No file uploaded' });
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
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to upload avatar' });
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
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to remove avatar' });
  }
});

// GET /api/auth/avatar/:userId — serve avatar file
router.get('/avatar/:userId', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT avatar_path FROM users WHERE id = $1', [req.params.userId]);
    const avatarPath = result.rows[0]?.avatar_path;

    if (!avatarPath) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'No avatar found' });
      return;
    }

    if (!isPathSafe(avatarPath, AVATAR_STORAGE_PATH)) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Invalid avatar path' });
      return;
    }

    if (!fs.existsSync(avatarPath)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Avatar file not found' });
      return;
    }

    const ext = path.extname(avatarPath).toLowerCase();
    const mimeMap: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
    res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fs.createReadStream(avatarPath).pipe(res);
  } catch (err) {
    console.error('Serve avatar error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to serve avatar' });
  }
});

// DELETE /api/auth/account — permanently delete account
router.delete('/account', authenticate, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Password is required' });
      return;
    }

    const userId = req.user!.id;

    // Verify password
    const userResult = await query('SELECT password_hash, avatar_path FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      return;
    }

    const valid = await bcrypt.compare(password, userResult.rows[0].password_hash);
    if (!valid) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Incorrect password' });
      return;
    }

    const avatarPath = userResult.rows[0].avatar_path;

    // Find locations where user is a member
    const locationsResult = await query(
      `SELECT l.id FROM locations l JOIN location_members lm ON l.id = lm.location_id WHERE lm.user_id = $1`,
      [userId]
    );

    const PHOTO_STORAGE = process.env.PHOTO_STORAGE_PATH || './uploads';

    for (const location of locationsResult.rows) {
      const countResult = await query('SELECT COUNT(*) FROM location_members WHERE location_id = $1', [location.id]);
      const memberCount = parseInt(countResult.rows[0].count, 10);

      if (memberCount === 1) {
        // Sole member — delete photo files for all bins in this location
        const photosResult = await query(
          `SELECT p.storage_path FROM photos p JOIN bins b ON p.bin_id = b.id WHERE b.location_id = $1`,
          [location.id]
        );
        for (const photo of photosResult.rows) {
          try { fs.unlinkSync(path.join(PHOTO_STORAGE, photo.storage_path)); } catch { /* ignore */ }
        }
        // Delete bin directories
        const binsResult = await query('SELECT id FROM bins WHERE location_id = $1', [location.id]);
        for (const bin of binsResult.rows) {
          const binDir = path.join(PHOTO_STORAGE, bin.id);
          try { fs.rmSync(binDir, { recursive: true, force: true }); } catch { /* ignore */ }
        }
        // Cascade deletes bins, photos, tag_colors, location_members
        await query('DELETE FROM locations WHERE id = $1', [location.id]);
      }
      // If count > 1, location_members row is removed by ON DELETE CASCADE on users
    }

    // Delete avatar file
    if (avatarPath) {
      try { fs.unlinkSync(avatarPath); } catch { /* ignore */ }
    }

    // Delete user — cascades location_members, sets NULL on bins/photos/locations created_by
    await query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete account' });
  }
});

export default router;
