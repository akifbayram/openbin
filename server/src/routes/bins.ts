import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH || './uploads';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const binId = req.params.id;
    const dir = path.join(PHOTO_STORAGE_PATH, binId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
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

/** Verify user is a member of the home that owns a bin */
async function verifyBinAccess(binId: string, userId: string): Promise<{ homeId: string } | null> {
  const result = await query(
    `SELECT b.home_id FROM bins b
     JOIN home_members hm ON hm.home_id = b.home_id AND hm.user_id = $2
     WHERE b.id = $1`,
    [binId, userId]
  );
  if (result.rows.length === 0) return null;
  return { homeId: result.rows[0].home_id };
}

/** Verify user is a member of a specific home */
async function verifyHomeMembership(homeId: string, userId: string): Promise<boolean> {
  const result = await query(
    'SELECT id FROM home_members WHERE home_id = $1 AND user_id = $2',
    [homeId, userId]
  );
  return result.rows.length > 0;
}

// POST /api/bins — create bin
router.post('/', async (req, res) => {
  try {
    const { homeId, name, location, items, notes, tags, icon, color, id } = req.body;

    if (!homeId) {
      res.status(400).json({ error: 'homeId is required' });
      return;
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Bin name is required' });
      return;
    }

    if (!await verifyHomeMembership(homeId, req.user!.id)) {
      res.status(403).json({ error: 'Not a member of this home' });
      return;
    }

    const params: unknown[] = [
      homeId,
      name.trim(),
      location || '',
      items || [],
      notes || '',
      tags || [],
      icon || '',
      color || '',
      req.user!.id,
    ];

    let sql: string;
    if (id) {
      // Allow specifying ID for undo-restore
      sql = `INSERT INTO bins (id, home_id, name, location, items, notes, tags, icon, color, created_by)
             VALUES ($10, $1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, home_id, name, location, items, notes, tags, icon, color, created_by, created_at, updated_at`;
      params.push(id);
    } else {
      sql = `INSERT INTO bins (home_id, name, location, items, notes, tags, icon, color, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, home_id, name, location, items, notes, tags, icon, color, created_by, created_at, updated_at`;
    }

    const result = await query(sql, params);
    const bin = result.rows[0];

    res.status(201).json(bin);
  } catch (err) {
    console.error('Create bin error:', err);
    res.status(500).json({ error: 'Failed to create bin' });
  }
});

// GET /api/bins — list all bins for a home
router.get('/', async (req, res) => {
  try {
    const homeId = req.query.home_id as string | undefined;

    if (!homeId) {
      res.status(400).json({ error: 'home_id query parameter is required' });
      return;
    }

    if (!await verifyHomeMembership(homeId, req.user!.id)) {
      res.status(403).json({ error: 'Not a member of this home' });
      return;
    }

    const result = await query(
      `SELECT id, home_id, name, location, items, notes, tags, icon, color, created_by, created_at, updated_at
       FROM bins WHERE home_id = $1 ORDER BY updated_at DESC`,
      [homeId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('List bins error:', err);
    res.status(500).json({ error: 'Failed to list bins' });
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
      'SELECT id, home_id, name, location, items, notes, tags, icon, color, created_by, created_at, updated_at FROM bins WHERE id = $1',
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

    const { name, location, items, notes, tags, icon, color } = req.body;

    const setClauses: string[] = ['updated_at = now()'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${paramIdx++}`);
      params.push(name);
    }
    if (location !== undefined) {
      setClauses.push(`location = $${paramIdx++}`);
      params.push(location);
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
       RETURNING id, home_id, name, location, items, notes, tags, icon, color, created_by, created_at, updated_at`,
      params
    );

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
      'SELECT id, home_id, name, location, items, notes, tags, icon, color, created_by, created_at, updated_at FROM bins WHERE id = $1',
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
