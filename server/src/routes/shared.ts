import path from 'node:path';
import { Router } from 'express';
import { d, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { config } from '../lib/config.js';
import { NotFoundError } from '../lib/httpErrors.js';
import { storage } from '../lib/storage.js';

const router = Router();

interface ShareRow {
  share_id: string;
  bin_id: string;
  visibility: string;
  expires_at: string | null;
}

async function resolveShare(token: string): Promise<ShareRow> {
  const result = await query<ShareRow>(
    `SELECT bs.id AS share_id, bs.bin_id, bs.visibility, bs.expires_at FROM bin_shares bs
     JOIN bins b ON b.id = bs.bin_id
     WHERE bs.token = $1 AND bs.revoked_at IS NULL AND b.deleted_at IS NULL AND b.visibility != 'private'`,
    [token],
  );
  if (result.rows.length === 0) throw new NotFoundError('This link is no longer available');
  const row = result.rows[0];
  if (row.expires_at) {
    // Ensure UTC parsing — SQLite datetime() omits timezone suffix
    const ts = row.expires_at.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(row.expires_at)
      ? row.expires_at
      : `${row.expires_at}Z`;
    if (new Date(ts) < new Date()) {
      throw new NotFoundError('This link has expired');
    }
  }
  return row;
}

/** Security headers for all shared responses */
function setSharedHeaders(res: import('express').Response): void {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

// GET /api/shared/:token — view a shared bin
router.get('/:token', asyncHandler(async (req, res) => {
  const share = await resolveShare(req.params.token);

  // Increment view count (fire-and-forget)
  query('UPDATE bin_shares SET view_count = view_count + 1 WHERE id = $1', [share.share_id]);

  // Fetch bin data
  const binResult = await query(
    `SELECT b.id, b.name, b.area_id, COALESCE(a.name, '') AS area_name,
       COALESCE((SELECT ${d.jsonGroupArray(d.jsonObject("'id'", 'bi.id', "'name'", 'bi.name', "'quantity'", 'bi.quantity'))} FROM (SELECT id, name, quantity FROM bin_items bi WHERE bi.bin_id = b.id AND bi.deleted_at IS NULL ORDER BY bi.position) bi), '[]') AS items,
       b.notes, b.tags, b.icon, b.color, b.card_style, b.created_at, b.updated_at,
       COALESCE((SELECT ${d.jsonGroupObject('bcfv.field_id', 'bcfv.value')} FROM bin_custom_field_values bcfv WHERE bcfv.bin_id = b.id), '{}') AS custom_fields
     FROM bins b LEFT JOIN areas a ON a.id = b.area_id
     WHERE b.id = $1 AND b.deleted_at IS NULL`,
    [share.bin_id],
  );

  if (binResult.rows.length === 0) throw new NotFoundError('Bin not found');

  const bin = binResult.rows[0];

  // Fetch photos list (IDs and filenames only)
  const photosResult = await query(
    'SELECT id, filename, mime_type, size, created_at FROM photos WHERE bin_id = $1 ORDER BY created_at',
    [share.bin_id],
  );

  // Strip internal IDs that are not needed by the shared page
  const { id: _binId, area_id: _areaId, ...safeBin } = bin;
  const safePhotos = photosResult.rows.map((p) => ({ id: p.id, filename: p.filename }));
  const rawItems = typeof safeBin.items === 'string' ? JSON.parse(safeBin.items) : safeBin.items;
  const safeItems = (rawItems as Array<{ name: string; quantity: number | null }>)
    .map((i) => ({ name: i.name, quantity: i.quantity }));

  setSharedHeaders(res);
  res.json({
    ...safeBin,
    items: safeItems,
    photos: safePhotos,
    shareToken: req.params.token,
  });
}));

// GET /api/shared/:token/photos/:photoId/file — serve photo from shared bin
router.get('/:token/photos/:photoId/file', asyncHandler(async (req, res) => {
  const share = await resolveShare(req.params.token);

  const photoResult = await query(
    'SELECT storage_path, mime_type FROM photos WHERE id = $1 AND bin_id = $2',
    [req.params.photoId, share.bin_id],
  );
  if (photoResult.rows.length === 0) throw new NotFoundError('Photo not found');

  const photo = photoResult.rows[0];
  if (!(await storage.exists(photo.storage_path))) throw new NotFoundError('Photo file not found');

  setSharedHeaders(res);
  res.setHeader('Content-Type', photo.mime_type || 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  storage.readStream(photo.storage_path).pipe(res);
}));

// GET /api/shared/:token/photos/:photoId/thumb — serve thumbnail from shared bin
router.get('/:token/photos/:photoId/thumb', asyncHandler(async (req, res) => {
  const share = await resolveShare(req.params.token);

  const photoResult = await query(
    'SELECT storage_path, thumb_path FROM photos WHERE id = $1 AND bin_id = $2',
    [req.params.photoId, share.bin_id],
  );
  if (photoResult.rows.length === 0) throw new NotFoundError('Photo not found');

  const photo = photoResult.rows[0];

  setSharedHeaders(res);

  // Serve existing thumbnail if available
  if (photo.thumb_path && (await storage.exists(photo.thumb_path))) {
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    storage.readStream(photo.thumb_path).pipe(res);
    return;
  }

  // Generate thumbnail lazily
  if (!(await storage.exists(photo.storage_path))) throw new NotFoundError('Photo file not found');

  try {
    const thumbFilename = `${path.basename(photo.storage_path, path.extname(photo.storage_path))}_thumb.webp`;
    const thumbStoragePath = path.join(path.dirname(photo.storage_path), thumbFilename);

    if (config.storageBackend === 's3') {
      const { generateThumbnailBuffer } = await import('../lib/thumbnailPool.js');
      const originalBuffer = await storage.read(photo.storage_path);
      const thumbBuffer = await generateThumbnailBuffer(originalBuffer);
      await storage.upload(thumbStoragePath, thumbBuffer, 'image/webp');
      await query('UPDATE photos SET thumb_path = $1 WHERE id = $2', [thumbStoragePath, req.params.photoId]);

      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.end(thumbBuffer);
    } else {
      const { generateThumbnail } = await import('../lib/photoHelpers.js');
      const { safePath } = await import('../lib/pathSafety.js');
      const { PHOTO_STORAGE_PATH } = await import('../lib/uploadConfig.js');

      const thumbFullPath = path.join(PHOTO_STORAGE_PATH, thumbStoragePath);
      const originalFile = safePath(PHOTO_STORAGE_PATH, photo.storage_path);
      if (!originalFile) throw new NotFoundError('Photo file not found');

      await generateThumbnail(originalFile, thumbFullPath);
      await query('UPDATE photos SET thumb_path = $1 WHERE id = $2', [thumbStoragePath, req.params.photoId]);

      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      storage.readStream(thumbStoragePath).pipe(res);
    }
  } catch {
    // Fallback to original photo
    const mimeResult = await query('SELECT mime_type FROM photos WHERE id = $1', [req.params.photoId]);
    const mimeType = mimeResult.rows[0]?.mime_type || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    storage.readStream(photo.storage_path).pipe(res);
  }
}));

export { router as sharedRoutes };
