import { Router } from 'express';
import { query, generateUuid } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// GET /api/print-settings
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT settings FROM user_print_settings WHERE user_id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      res.json(null);
      return;
    }

    res.json(result.rows[0].settings);
  } catch (err) {
    console.error('Get print settings error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get print settings' });
  }
});

// PUT /api/print-settings
router.put('/', async (req, res) => {
  try {
    const settings = req.body;

    if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Body must be a JSON object' });
      return;
    }

    const newId = generateUuid();
    const result = await query(
      `INSERT INTO user_print_settings (id, user_id, settings)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET settings = $3, updated_at = datetime('now')
       RETURNING settings`,
      [newId, req.user!.id, JSON.stringify(settings)]
    );

    res.json(result.rows[0].settings);
  } catch (err) {
    console.error('Save print settings error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to save print settings' });
  }
});

export default router;
