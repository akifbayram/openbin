import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH || './uploads';

const SHORT_CODE_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function generateShortCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += SHORT_CODE_CHARSET[crypto.randomInt(SHORT_CODE_CHARSET.length)];
  }
  return code;
}

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

/** Verify user is a member of the location that owns a bin */
async function verifyBinAccess(binId: string, userId: string): Promise<{ locationId: string } | null> {
  const result = await query(
    `SELECT b.location_id FROM bins b
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
     WHERE b.id = $1`,
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

// POST /api/bins — create bin
router.post('/', async (req, res) => {
  try {
    const { locationId, name, areaId, items, notes, tags, icon, color, id, shortCode } = req.body;

    if (!locationId) {
      res.status(400).json({ error: 'locationId is required' });
      return;
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Bin name is required' });
      return;
    }
    if (name.trim().length > 255) {
      res.status(400).json({ error: 'Bin name must be 255 characters or less' });
      return;
    }
    if (items && Array.isArray(items) && items.length > 500) {
      res.status(400).json({ error: 'Too many items (max 500)' });
      return;
    }
    if (tags && Array.isArray(tags) && tags.length > 50) {
      res.status(400).json({ error: 'Too many tags (max 50)' });
      return;
    }
    if (notes && typeof notes === 'string' && notes.length > 10000) {
      res.status(400).json({ error: 'Notes too long (max 10000 characters)' });
      return;
    }

    if (!await verifyLocationMembership(locationId, req.user!.id)) {
      res.status(403).json({ error: 'Not a member of this location' });
      return;
    }

    // Generate short_code with retry on collision
    const sc = shortCode || generateShortCode();
    const maxRetries = 10;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const code = attempt === 0 ? sc : generateShortCode();
      const params: unknown[] = [
        locationId,
        name.trim(),
        areaId || null,
        items || [],
        notes || '',
        tags || [],
        icon || '',
        color || '',
        req.user!.id,
        code,
      ];

      let sql: string;
      if (id) {
        sql = `INSERT INTO bins (id, location_id, name, area_id, items, notes, tags, icon, color, created_by, short_code)
               VALUES ($11, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               RETURNING id, location_id, name, area_id, items, notes, tags, icon, color, short_code, created_by, created_at, updated_at`;
        params.push(id);
      } else {
        sql = `INSERT INTO bins (location_id, name, area_id, items, notes, tags, icon, color, created_by, short_code)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               RETURNING id, location_id, name, area_id, items, notes, tags, icon, color, short_code, created_by, created_at, updated_at`;
      }

      try {
        const result = await query(sql, params);
        const bin = result.rows[0];
        // Fetch area_name if area_id is set
        if (bin.area_id) {
          const areaResult = await query('SELECT name FROM areas WHERE id = $1', [bin.area_id]);
          bin.area_name = areaResult.rows[0]?.name ?? '';
        } else {
          bin.area_name = '';
        }
        res.status(201).json(bin);
        return;
      } catch (err: unknown) {
        const pgErr = err as { code?: string; constraint?: string };
        if (pgErr.code === '23505' && pgErr.constraint === 'bins_short_code_key' && attempt < maxRetries) {
          continue; // retry with new code
        }
        throw err;
      }
    }

    res.status(500).json({ error: 'Failed to generate unique short code' });
  } catch (err) {
    console.error('Create bin error:', err);
    res.status(500).json({ error: 'Failed to create bin' });
  }
});

// GET /api/bins — list all bins for a location
router.get('/', async (req, res) => {
  try {
    const locationId = req.query.location_id as string | undefined;

    if (!locationId) {
      res.status(400).json({ error: 'location_id query parameter is required' });
      return;
    }

    if (!await verifyLocationMembership(locationId, req.user!.id)) {
      res.status(403).json({ error: 'Not a member of this location' });
      return;
    }

    const result = await query(
      `SELECT b.id, b.location_id, b.name, b.area_id, COALESCE(a.name, '') AS area_name, b.items, b.notes, b.tags, b.icon, b.color, b.short_code, b.created_by, b.created_at, b.updated_at
       FROM bins b LEFT JOIN areas a ON a.id = b.area_id
       WHERE b.location_id = $1 ORDER BY b.updated_at DESC`,
      [locationId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('List bins error:', err);
    res.status(500).json({ error: 'Failed to list bins' });
  }
});

// GET /api/bins/lookup/:shortCode — lookup bin by short code
router.get('/lookup/:shortCode', async (req, res) => {
  try {
    const code = req.params.shortCode.toUpperCase();

    const result = await query(
      `SELECT b.id, b.location_id, b.name, b.area_id, COALESCE(a.name, '') AS area_name, b.items, b.notes, b.tags, b.icon, b.color, b.short_code, b.created_by, b.created_at, b.updated_at
       FROM bins b
       LEFT JOIN areas a ON a.id = b.area_id
       JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
       WHERE UPPER(b.short_code) = $1`,
      [code, req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Bin not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Lookup bin error:', err);
    res.status(500).json({ error: 'Failed to lookup bin' });
  }
});

// GET /api/bins/:id — get single bin
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const access = await verifyBinAccess(id, req.user!.id);
    if (!access) {
      res.status(404).json({ error: 'Bin not found' });
      return;
    }

    const result = await query(
      `SELECT b.id, b.location_id, b.name, b.area_id, COALESCE(a.name, '') AS area_name, b.items, b.notes, b.tags, b.icon, b.color, b.short_code, b.created_by, b.created_at, b.updated_at
       FROM bins b LEFT JOIN areas a ON a.id = b.area_id
       WHERE b.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Bin not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get bin error:', err);
    res.status(500).json({ error: 'Failed to get bin' });
  }
});

// PUT /api/bins/:id — update bin
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const access = await verifyBinAccess(id, req.user!.id);
    if (!access) {
      res.status(404).json({ error: 'Bin not found' });
      return;
    }

    const { name, areaId, items, notes, tags, icon, color } = req.body;

    if (name !== undefined && typeof name === 'string' && name.trim().length > 255) {
      res.status(400).json({ error: 'Bin name must be 255 characters or less' });
      return;
    }
    if (items !== undefined && Array.isArray(items) && items.length > 500) {
      res.status(400).json({ error: 'Too many items (max 500)' });
      return;
    }
    if (tags !== undefined && Array.isArray(tags) && tags.length > 50) {
      res.status(400).json({ error: 'Too many tags (max 50)' });
      return;
    }
    if (notes !== undefined && typeof notes === 'string' && notes.length > 10000) {
      res.status(400).json({ error: 'Notes too long (max 10000 characters)' });
      return;
    }

    const setClauses: string[] = ['updated_at = now()'];
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
      `UPDATE bins SET ${setClauses.join(', ')} WHERE id = $${paramIdx}
       RETURNING id, location_id, name, area_id, items, notes, tags, icon, color, short_code, created_by, created_at, updated_at`,
      params
    );

    if (result.rows.length > 0) {
      const bin = result.rows[0];
      if (bin.area_id) {
        const areaResult = await query('SELECT name FROM areas WHERE id = $1', [bin.area_id]);
        bin.area_name = areaResult.rows[0]?.name ?? '';
      } else {
        bin.area_name = '';
      }
    }

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Bin not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update bin error:', err);
    res.status(500).json({ error: 'Failed to update bin' });
  }
});

// DELETE /api/bins/:id — delete bin, return deleted bin for undo
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const access = await verifyBinAccess(id, req.user!.id);
    if (!access) {
      res.status(404).json({ error: 'Bin not found' });
      return;
    }

    // Fetch bin before deleting for undo
    const binResult = await query(
      `SELECT b.id, b.location_id, b.name, b.area_id, COALESCE(a.name, '') AS area_name, b.items, b.notes, b.tags, b.icon, b.color, b.short_code, b.created_by, b.created_at, b.updated_at
       FROM bins b LEFT JOIN areas a ON a.id = b.area_id
       WHERE b.id = $1`,
      [id]
    );

    if (binResult.rows.length === 0) {
      res.status(404).json({ error: 'Bin not found' });
      return;
    }

    const bin = binResult.rows[0];

    // Get photos to delete from disk
    const photosResult = await query(
      'SELECT storage_path FROM photos WHERE bin_id = $1',
      [id]
    );

    // Delete bin (cascades to photos in DB)
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

    res.json(bin);
  } catch (err) {
    console.error('Delete bin error:', err);
    res.status(500).json({ error: 'Failed to delete bin' });
  }
});

// POST /api/bins/:id/photos — upload photo for a bin
router.post('/:id/photos', upload.single('photo'), async (req, res) => {
  try {
    const binId = req.params.id;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No photo uploaded' });
      return;
    }

    const access = await verifyBinAccess(binId, req.user!.id);
    if (!access) {
      fs.unlinkSync(file.path);
      res.status(404).json({ error: 'Bin not found' });
      return;
    }

    const storagePath = path.join(binId, file.filename);

    const result = await query(
      `INSERT INTO photos (bin_id, filename, mime_type, size, storage_path, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, bin_id, filename, mime_type, size, storage_path, created_by, created_at`,
      [binId, file.originalname, file.mimetype, file.size, storagePath, req.user!.id]
    );

    await query('UPDATE bins SET updated_at = now() WHERE id = $1', [binId]);

    const photo = result.rows[0];
    res.status(201).json({ id: photo.id });
  } catch (err) {
    console.error('Upload photo error:', err);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// PUT /api/bins/:id/add-tags — add tags to a bin (merge, don't replace)
router.put('/:id/add-tags', async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags)) {
      res.status(400).json({ error: 'tags array is required' });
      return;
    }

    const access = await verifyBinAccess(id, req.user!.id);
    if (!access) {
      res.status(404).json({ error: 'Bin not found' });
      return;
    }

    // Merge tags using array_cat + array_distinct via unnest
    const result = await query(
      `UPDATE bins SET
         tags = (SELECT ARRAY(SELECT DISTINCT unnest(tags || $1::text[]))),
         updated_at = now()
       WHERE id = $2
       RETURNING id, tags`,
      [tags, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Bin not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Add tags error:', err);
    res.status(500).json({ error: 'Failed to add tags' });
  }
});

export default router;
