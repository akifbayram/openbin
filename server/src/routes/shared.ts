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
}

async function resolveShare(token: string): Promise<ShareRow> {
  const result = await query<ShareRow>(
    `SELECT bs.id AS share_id, bs.bin_id, bs.visibility FROM bin_shares bs
     JOIN bins b ON b.id = bs.bin_id
     WHERE bs.token = $1 AND bs.revoked_at IS NULL AND b.deleted_at IS NULL AND b.visibility != 'private'`,
    [token],
  );
  if (result.rows.length === 0) throw new NotFoundError('This link is no longer available');
  return result.rows[0];
}

// GET /api/shared/:token — view a shared bin
router.get('/:token', asyncHandler(async (req, res) => {
  const share = await resolveShare(req.params.token);

  // Increment view count (fire-and-forget)
  query('UPDATE bin_shares SET view_count = view_count + 1 WHERE id = $1', [share.share_id]);

  // Fetch bin data
  const binResult = await query(
    `SELECT b.id, b.name, b.area_id, COALESCE(a.name, '') AS area_name,
       COALESCE((SELECT ${d.jsonGroupArray(d.jsonObject("'id'", 'bi.id', "'name'", 'bi.name', "'quantity'", 'bi.quantity'))} FROM (SELECT id, name, quantity FROM bin_items bi WHERE bi.bin_id = b.id ORDER BY bi.position) bi), '[]') AS items,
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

  res.json({
    ...bin,
    photos: photosResult.rows,
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

  res.setHeader('Content-Type', photo.mime_type || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
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

  // Serve existing thumbnail if available
  if (photo.thumb_path && (await storage.exists(photo.thumb_path))) {
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    storage.readStream(photo.thumb_path).pipe(res);
    return;
  }

  // Generate thumbnail lazily
  if (!(await storage.exists(photo.storage_path))) throw new NotFoundError('Photo file not found');

  const thumbFilename = `${path.basename(photo.storage_path, path.extname(photo.storage_path))}_thumb.webp`;
  const thumbStoragePath = path.join(path.dirname(photo.storage_path), thumbFilename);

  if (config.storageBackend === 's3') {
    const { generateThumbnailBuffer } = await import('../lib/thumbnailPool.js');
    const originalBuffer = await storage.read(photo.storage_path);
    const thumbBuffer = await generateThumbnailBuffer(originalBuffer);
    await storage.upload(thumbStoragePath, thumbBuffer, 'image/webp');
    await query('UPDATE photos SET thumb_path = $1 WHERE id = $2', [thumbStoragePath, req.params.photoId]);

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
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
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    storage.readStream(thumbStoragePath).pipe(res);
  }
}));

export { router as sharedRoutes };
