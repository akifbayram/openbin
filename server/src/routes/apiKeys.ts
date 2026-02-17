import { Router } from 'express';
import crypto from 'crypto';
import { query, generateUuid } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const MAX_KEYS_PER_USER = 10;

function generateApiKey(): string {
  return 'sk_openbin_' + crypto.randomBytes(32).toString('hex');
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// GET /api/api-keys — list user's API keys
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, key_prefix, name, created_at, last_used_at, revoked_at
       FROM api_keys
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [req.user!.id]
    );
    res.json({ results: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('List API keys error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list API keys' });
  }
});

// POST /api/api-keys — create a new API key
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;

    // Check max keys
    const countResult = await query(
      'SELECT COUNT(*) as cnt FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL',
      [req.user!.id]
    );
    if ((countResult.rows[0] as { cnt: number }).cnt >= MAX_KEYS_PER_USER) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: `Maximum ${MAX_KEYS_PER_USER} active API keys allowed` });
      return;
    }

    const key = generateApiKey();
    const keyHash = hashKey(key);
    const keyPrefix = key.slice(0, 18);
    const id = generateUuid();

    await query(
      `INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, req.user!.id, keyHash, keyPrefix, (name || '').trim().slice(0, 255)]
    );

    res.status(201).json({
      id,
      key,
      keyPrefix,
      name: (name || '').trim().slice(0, 255),
    });
  } catch (err) {
    console.error('Create API key error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create API key' });
  }
});

// DELETE /api/api-keys/:id — revoke an API key
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE api_keys SET revoked_at = datetime('now')
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
       RETURNING id`,
      [id, req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'API key not found' });
      return;
    }

    res.json({ message: 'API key revoked' });
  } catch (err) {
    console.error('Revoke API key error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to revoke API key' });
  }
});

export default router;
