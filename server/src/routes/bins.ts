import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query, generateUuid } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logActivity, computeChanges } from '../lib/activityLog.js';
import { purgeExpiredTrash } from '../lib/trashPurge.js';
import { generateShortCode } from '../lib/shortCode.js';

const router = Router();
const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH || './uploads';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MIME_TO_EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const binId = req.params.id;
    const dir = path.join(PHOTO_STORAGE_PATH, binId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
  },
});

router.use(authenticate);

/** Verify user is a member of the location that owns a non-deleted bin */
async function verifyBinAccess(binId: string, userId: string): Promise<{ locationId: string } | null> {
  const result = await query(
    `SELECT b.location_id FROM bins b
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
     WHERE b.id = $1 AND b.deleted_at IS NULL`,
    [binId, userId]
  );
  if (result.rows.length === 0) return null;
  return { locationId: result.rows[0].location_id };
}

/** Verify user is a member of a specific location */
async function verifyLocationMembership(locationId: string, userId: string): Promise<boolean> {
  const result = await query(
    'SELECT id FROM location_members WHERE location_id = $1 AND user_id = $2',
    [locationId, userId]
  );
  return result.rows.length > 0;
}

const BIN_SELECT_COLS = `b.id, b.location_id, b.name, b.area_id, COALESCE(a.name, '') AS area_name, b.items, b.notes, b.tags, b.icon, b.color, b.short_code, b.created_by, b.created_at, b.updated_at`;

// POST /api/bins — create bin
router.post('/', async (req, res) => {
  try {
    const { locationId, name, areaId, items, notes, tags, icon, color, id, shortCode } = req.body;

    if (!locationId) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'locationId is required' });
      return;
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Bin name is required' });
      return;
    }
    if (name.trim().length > 255) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Bin name must be 255 characters or less' });
      return;
    }
    if (items && Array.isArray(items) && items.length > 500) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Too many items (max 500)' });
      return;
    }
    if (tags && Array.isArray(tags) && tags.length > 50) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Too many tags (max 50)' });
      return;
    }
    if (notes && typeof notes === 'string' && notes.length > 10000) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Notes too long (max 10000 characters)' });
      return;
    }

    if (!await verifyLocationMembership(locationId, req.user!.id)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
      return;
    }

    // Generate short_code with retry on collision
    const sc = shortCode || generateShortCode();
    const maxRetries = 10;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const code = attempt === 0 ? sc : generateShortCode();
      const binId = id || generateUuid();

      try {
        const result = await query(
          `INSERT INTO bins (id, location_id, name, area_id, items, notes, tags, icon, color, created_by, short_code)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, location_id, name, area_id, items, notes, tags, icon, color, short_code, created_by, created_at, updated_at`,
          [binId, locationId, name.trim(), areaId || null, items || [], notes || '', tags || [], icon || '', color || '', req.user!.id, code]
        );
        const bin = result.rows[0];
        // Fetch area_name if area_id is set
        if (bin.area_id) {
          const areaResult = await query('SELECT name FROM areas WHERE id = $1', [bin.area_id]);
          bin.area_name = areaResult.rows[0]?.name ?? '';
        } else {
          bin.area_name = '';
        }

        logActivity({
          locationId,
          userId: req.user!.id,
          userName: req.user!.username,
          action: 'create',
          entityType: 'bin',
          entityId: bin.id,
          entityName: bin.name,
        });

        res.status(201).json(bin);
        return;
      } catch (err: unknown) {
        const sqliteErr = err as { code?: string };
        if (sqliteErr.code === 'SQLITE_CONSTRAINT_UNIQUE' && attempt < maxRetries) {
          continue; // retry with new code
        }
        throw err;
      }
    }

    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to generate unique short code' });
  } catch (err) {
    console.error('Create bin error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create bin' });
  }
});

// GET /api/bins — list all (non-deleted) bins for a location
// Optional query params: q, tag, area_id, sort, sort_dir, needs_organizing
router.get('/', async (req, res) => {
  try {
    const locationId = req.query.location_id as string | undefined;

    if (!locationId) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'location_id query parameter is required' });
      return;
    }

    if (!await verifyLocationMembership(locationId, req.user!.id)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
      return;
    }

    const q = req.query.q as string | undefined;
    const tag = req.query.tag as string | undefined;
    const areaId = req.query.area_id as string | undefined;
    const needsOrganizing = req.query.needs_organizing as string | undefined;
    const sort = req.query.sort as string | undefined;
    const sortDir = req.query.sort_dir as string | undefined;

    const whereClauses: string[] = ['b.location_id = $1', 'b.deleted_at IS NULL'];
    const params: unknown[] = [locationId];
    let paramIdx = 2;

    if (q && q.trim()) {
      const searchTerm = `%${q.trim()}%`;
      whereClauses.push(
        `(b.name LIKE $${paramIdx} OR b.notes LIKE $${paramIdx} OR b.short_code LIKE $${paramIdx} OR COALESCE(a.name, '') LIKE $${paramIdx} OR EXISTS (SELECT 1 FROM json_each(b.items) WHERE value LIKE $${paramIdx}) OR EXISTS (SELECT 1 FROM json_each(b.tags) WHERE value LIKE $${paramIdx}))`
      );
      params.push(searchTerm);
      paramIdx++;
    }

    if (tag && tag.trim()) {
      whereClauses.push(`EXISTS (SELECT 1 FROM json_each(b.tags) WHERE value = $${paramIdx})`);
      params.push(tag.trim());
      paramIdx++;
    }

    if (areaId) {
      if (areaId === '__unassigned__') {
        whereClauses.push('b.area_id IS NULL');
      } else {
        whereClauses.push(`b.area_id = $${paramIdx}`);
        params.push(areaId);
        paramIdx++;
      }
    }

    if (needsOrganizing === 'true') {
      whereClauses.push(`(b.tags = '[]' OR b.tags = '') AND b.area_id IS NULL AND (b.items = '[]' OR b.items = '')`);
    }

    const validSorts: Record<string, string> = {
      name: 'b.name',
      created_at: 'b.created_at',
      updated_at: 'b.updated_at',
      area: 'CASE WHEN a.name IS NULL OR a.name = \'\' THEN 1 ELSE 0 END, a.name, b.name',
    };
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
    const orderBy = validSorts[sort || ''] || 'b.updated_at';
    const orderClause = sort === 'area' ? `${orderBy} ${dir}` : `${orderBy} ${dir}`;

    const result = await query(
      `SELECT ${BIN_SELECT_COLS}
       FROM bins b LEFT JOIN areas a ON a.id = b.area_id
       WHERE ${whereClauses.join(' AND ')} ORDER BY ${orderClause}`,
      params
    );

    res.json({ results: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('List bins error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list bins' });
  }
});

// GET /api/bins/trash — list soft-deleted bins for a location
router.get('/trash', async (req, res) => {
  try {
    const locationId = req.query.location_id as string | undefined;

    if (!locationId) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'location_id query parameter is required' });
      return;
    }

    if (!await verifyLocationMembership(locationId, req.user!.id)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
      return;
    }

    // Fire-and-forget: purge bins past retention period
    purgeExpiredTrash(locationId).catch(() => {});

    const result = await query(
      `SELECT ${BIN_SELECT_COLS}, b.deleted_at
       FROM bins b LEFT JOIN areas a ON a.id = b.area_id
       WHERE b.location_id = $1 AND b.deleted_at IS NOT NULL ORDER BY b.deleted_at DESC`,
      [locationId]
    );

    res.json({ results: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('List trash error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list trash' });
  }
});

// GET /api/bins/lookup/:shortCode — lookup bin by short code
router.get('/lookup/:shortCode', async (req, res) => {
  try {
    const code = req.params.shortCode.toUpperCase();

    const result = await query(
      `SELECT ${BIN_SELECT_COLS}
       FROM bins b
       LEFT JOIN areas a ON a.id = b.area_id
       JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
       WHERE UPPER(b.short_code) = $1 AND b.deleted_at IS NULL`,
      [code, req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Bin not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Lookup bin error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to lookup bin' });
  }
});

// GET /api/bins/:id — get single bin
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const access = await verifyBinAccess(id, req.user!.id);
    if (!access) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Bin not found' });
      return;
    }

    const result = await query(
      `SELECT ${BIN_SELECT_COLS}
       FROM bins b LEFT JOIN areas a ON a.id = b.area_id
       WHERE b.id = $1 AND b.deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Bin not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get bin error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get bin' });
  }
});

// PUT /api/bins/:id — update bin
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const access = await verifyBinAccess(id, req.user!.id);
    if (!access) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Bin not found' });
      return;
    }

    const { name, areaId, items, notes, tags, icon, color } = req.body;

    if (name !== undefined && typeof name === 'string' && name.trim().length > 255) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Bin name must be 255 characters or less' });
      return;
    }
    if (items !== undefined && Array.isArray(items) && items.length > 500) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Too many items (max 500)' });
      return;
    }
    if (tags !== undefined && Array.isArray(tags) && tags.length > 50) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Too many tags (max 50)' });
      return;
    }
    if (notes !== undefined && typeof notes === 'string' && notes.length > 10000) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Notes too long (max 10000 characters)' });
      return;
    }

    // Fetch old state for activity log diff
    const oldResult = await query(
      'SELECT name, area_id, items, notes, tags, icon, color FROM bins WHERE id = $1',
      [id]
    );
    const oldBin = oldResult.rows[0];

    const setClauses: string[] = ["updated_at = datetime('now')"];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${paramIdx++}`);
      params.push(name);
    }
    if (areaId !== undefined) {
      setClauses.push(`area_id = $${paramIdx++}`);
      params.push(areaId || null);
    }
    if (items !== undefined) {
      setClauses.push(`items = $${paramIdx++}`);
      params.push(items);
    }
    if (notes !== undefined) {
      setClauses.push(`notes = $${paramIdx++}`);
      params.push(notes);
    }
    if (tags !== undefined) {
      setClauses.push(`tags = $${paramIdx++}`);
      params.push(tags);
    }
    if (icon !== undefined) {
      setClauses.push(`icon = $${paramIdx++}`);
      params.push(icon);
    }
    if (color !== undefined) {
      setClauses.push(`color = $${paramIdx++}`);
      params.push(color);
    }

    params.push(id);

    const result = await query(
      `UPDATE bins SET ${setClauses.join(', ')} WHERE id = $${paramIdx} AND deleted_at IS NULL
       RETURNING id, location_id, name, area_id, items, notes, tags, icon, color, short_code, created_by, created_at, updated_at`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Bin not found' });
      return;
    }

    const bin = result.rows[0];
    if (bin.area_id) {
      const areaResult = await query('SELECT name FROM areas WHERE id = $1', [bin.area_id]);
      bin.area_name = areaResult.rows[0]?.name ?? '';
    } else {
      bin.area_name = '';
    }

    if (oldBin) {
      const newObj: Record<string, unknown> = {};
      if (name !== undefined) newObj.name = name;
      if (areaId !== undefined) newObj.area_id = areaId || null;
      if (items !== undefined) newObj.items = items;
      if (notes !== undefined) newObj.notes = notes;
      if (tags !== undefined) newObj.tags = tags;
      if (icon !== undefined) newObj.icon = icon;
      if (color !== undefined) newObj.color = color;

      const changes = computeChanges(oldBin, newObj, Object.keys(newObj));
      logActivity({
        locationId: access.locationId,
        userId: req.user!.id,
        userName: req.user!.username,
        action: 'update',
        entityType: 'bin',
        entityId: id,
        entityName: bin.name,
        changes,
      });
    }

    res.json(bin);
  } catch (err) {
    console.error('Update bin error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update bin' });
  }
});

// DELETE /api/bins/:id — soft-delete bin
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const access = await verifyBinAccess(id, req.user!.id);
    if (!access) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Bin not found' });
      return;
    }

    // Fetch bin before soft-deleting for response
    const binResult = await query(
      `SELECT ${BIN_SELECT_COLS}
       FROM bins b LEFT JOIN areas a ON a.id = b.area_id
       WHERE b.id = $1 AND b.deleted_at IS NULL`,
      [id]
    );

    if (binResult.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Bin not found' });
      return;
    }

    const bin = binResult.rows[0];

    // Soft delete
    await query("UPDATE bins SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = $1", [id]);

    logActivity({
      locationId: access.locationId,
      userId: req.user!.id,
      userName: req.user!.username,
      action: 'delete',
      entityType: 'bin',
      entityId: id,
      entityName: bin.name,
    });

    res.json(bin);
  } catch (err) {
    console.error('Delete bin error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete bin' });
  }
});

// POST /api/bins/:id/restore — restore a soft-deleted bin
router.post('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;

    // Check access but for deleted bins
    const accessResult = await query(
      `SELECT b.location_id FROM bins b
       JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
       WHERE b.id = $1 AND b.deleted_at IS NOT NULL`,
      [id, req.user!.id]
    );

    if (accessResult.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Deleted bin not found' });
      return;
    }

    const locationId = accessResult.rows[0].location_id;

    const result = await query(
      `UPDATE bins SET deleted_at = NULL, updated_at = datetime('now') WHERE id = $1
       RETURNING id, location_id, name, area_id, items, notes, tags, icon, color, short_code, created_by, created_at, updated_at`,
      [id]
    );

    const bin = result.rows[0];
    if (bin.area_id) {
      const areaResult = await query('SELECT name FROM areas WHERE id = $1', [bin.area_id]);
      bin.area_name = areaResult.rows[0]?.name ?? '';
    } else {
      bin.area_name = '';
    }

    logActivity({
      locationId,
      userId: req.user!.id,
      userName: req.user!.username,
      action: 'restore',
      entityType: 'bin',
      entityId: id,
      entityName: bin.name,
    });

    res.json(bin);
  } catch (err) {
    console.error('Restore bin error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to restore bin' });
  }
});

// DELETE /api/bins/:id/permanent — permanently delete a soft-deleted bin
router.delete('/:id/permanent', async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow permanent delete of already soft-deleted bins
    const accessResult = await query(
      `SELECT b.location_id, b.name FROM bins b
       JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
       WHERE b.id = $1 AND b.deleted_at IS NOT NULL`,
      [id, req.user!.id]
    );

    if (accessResult.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Deleted bin not found' });
      return;
    }

    const { location_id: locationId, name: binName } = accessResult.rows[0];

    // Get photos to delete from disk
    const photosResult = await query(
      'SELECT storage_path FROM photos WHERE bin_id = $1',
      [id]
    );

    // Hard delete (cascades to photos in DB)
    await query('DELETE FROM bins WHERE id = $1', [id]);

    // Clean up photo files from disk
    for (const photo of photosResult.rows) {
      try {
        const filePath = path.join(PHOTO_STORAGE_PATH, photo.storage_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Ignore file cleanup errors
      }
    }

    // Clean up empty bin directory
    try {
      const binDir = path.join(PHOTO_STORAGE_PATH, id);
      if (fs.existsSync(binDir)) {
        fs.rmdirSync(binDir);
      }
    } catch {
      // Ignore directory cleanup errors
    }

    logActivity({
      locationId,
      userId: req.user!.id,
      userName: req.user!.username,
      action: 'permanent_delete',
      entityType: 'bin',
      entityId: id,
      entityName: binName,
    });

    res.json({ message: 'Bin permanently deleted' });
  } catch (err) {
    console.error('Permanent delete bin error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to permanently delete bin' });
  }
});

// POST /api/bins/:id/photos — upload photo for a bin
router.post('/:id/photos', upload.single('photo'), async (req, res) => {
  try {
    const binId = req.params.id;
    const file = req.file;

    if (!file) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'No photo uploaded' });
      return;
    }

    const access = await verifyBinAccess(binId, req.user!.id);
    if (!access) {
      fs.unlinkSync(file.path);
      res.status(404).json({ error: 'NOT_FOUND', message: 'Bin not found' });
      return;
    }

    const storagePath = path.join(binId, file.filename);
    const photoId = generateUuid();

    const result = await query(
      `INSERT INTO photos (id, bin_id, filename, mime_type, size, storage_path, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, bin_id, filename, mime_type, size, storage_path, created_by, created_at`,
      [photoId, binId, file.originalname, file.mimetype, file.size, storagePath, req.user!.id]
    );

    await query("UPDATE bins SET updated_at = datetime('now') WHERE id = $1", [binId]);

    const photo = result.rows[0];

    // Get bin name for activity log
    const binResult = await query('SELECT name FROM bins WHERE id = $1', [binId]);
    logActivity({
      locationId: access.locationId,
      userId: req.user!.id,
      userName: req.user!.username,
      action: 'add_photo',
      entityType: 'bin',
      entityId: binId,
      entityName: binResult.rows[0]?.name,
    });

    res.status(201).json({ id: photo.id });
  } catch (err) {
    console.error('Upload photo error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to upload photo' });
  }
});

// PUT /api/bins/:id/add-tags — add tags to a bin (merge, don't replace)
router.put('/:id/add-tags', async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags)) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'tags array is required' });
      return;
    }

    const access = await verifyBinAccess(id, req.user!.id);
    if (!access) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Bin not found' });
      return;
    }

    // Fetch existing tags, merge in JS, then update
    const existing = await query<{ tags: string[] }>(
      'SELECT tags FROM bins WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Bin not found' });
      return;
    }

    const currentTags: string[] = existing.rows[0].tags || [];
    const mergedTags = [...new Set([...currentTags, ...tags])];

    const result = await query(
      `UPDATE bins SET tags = $1, updated_at = datetime('now')
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, tags`,
      [mergedTags, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Bin not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Add tags error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to add tags' });
  }
});

export default router;
