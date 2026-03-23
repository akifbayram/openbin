import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError, ValidationError } from '../lib/httpErrors.js';
import { isPathSafe } from '../lib/pathSafety.js';
import { AVATAR_STORAGE_PATH, avatarUpload, validateFileType } from '../lib/uploadConfig.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

/** Resolve a relative avatar filename to an absolute path within the avatar storage directory. */
function resolveAvatarPath(relativePath: string): string {
  return path.join(AVATAR_STORAGE_PATH, relativePath);
}

// POST /api/auth/avatar — upload avatar
router.post('/avatar', avatarUpload.single('avatar'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ValidationError('No file uploaded');
  }

  await validateFileType(req.file.path);

  // Delete old avatar file if exists
  const existing = await query('SELECT avatar_path FROM users WHERE id = $1', [req.user!.id]);
  if (existing.rows[0]?.avatar_path) {
    const oldFullPath = resolveAvatarPath(existing.rows[0].avatar_path);
    try { fs.unlinkSync(oldFullPath); } catch { /* ignore */ }
  }

  // Store only the filename (relative path), not the absolute filesystem path
  const storagePath = path.basename(req.file.path);
  await query(`UPDATE users SET avatar_path = $1, updated_at = datetime('now') WHERE id = $2`, [storagePath, req.user!.id]);

  res.json({ avatarUrl: `/api/auth/avatar/${req.user!.id}` });
}));

// DELETE /api/auth/avatar — remove avatar
router.delete('/avatar', asyncHandler(async (req, res) => {
  const result = await query('SELECT avatar_path FROM users WHERE id = $1', [req.user!.id]);
  const avatarPath = result.rows[0]?.avatar_path;

  if (avatarPath) {
    const fullPath = resolveAvatarPath(avatarPath);
    try { fs.unlinkSync(fullPath); } catch { /* ignore */ }
  }

  await query(`UPDATE users SET avatar_path = NULL, updated_at = datetime('now') WHERE id = $1`, [req.user!.id]);

  res.json({ message: 'Avatar removed' });
}));

// GET /api/auth/avatar/:userId — serve avatar file
router.get('/avatar/:userId', asyncHandler(async (req, res) => {
  const result = await query('SELECT avatar_path FROM users WHERE id = $1', [req.params.userId]);
  const avatarPath = result.rows[0]?.avatar_path;

  if (!avatarPath) {
    throw new NotFoundError('No avatar found');
  }

  const fullPath = resolveAvatarPath(avatarPath);

  if (!isPathSafe(fullPath, AVATAR_STORAGE_PATH)) {
    throw new ValidationError('Invalid avatar path');
  }

  if (!fs.existsSync(fullPath)) {
    throw new NotFoundError('Avatar file not found');
  }

  const ext = path.extname(fullPath).toLowerCase();
  const mimeMap: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(fullPath).pipe(res);
}));

export default router;
