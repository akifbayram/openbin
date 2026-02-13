import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { analyzeImage, analyzeImages, testConnection, AiAnalysisError } from '../lib/aiProviders.js';
import type { AiProviderConfig, ImageInput } from '../lib/aiProviders.js';

const router = Router();

const AI_ENCRYPTION_KEY = process.env.AI_ENCRYPTION_KEY;

function getDerivedKey(): Buffer | null {
  if (!AI_ENCRYPTION_KEY) return null;
  return crypto.createHash('sha256').update(AI_ENCRYPTION_KEY).digest();
}

function encryptApiKey(plaintext: string): string {
  const key = getDerivedKey();
  if (!key) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptApiKey(stored: string): string {
  if (!stored.startsWith('enc:')) return stored;
  const key = getDerivedKey();
  if (!key) return stored;
  const parts = stored.split(':');
  if (parts.length !== 4) return stored;
  const [, ivHex, authTagHex, encryptedHex] = parts;
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    console.warn('Failed to decrypt API key, treating as plaintext');
    return stored;
  }
}
const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH || './uploads';
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.use(authenticate);

function maskApiKey(key: string): string {
  if (key.length <= 4) return '****';
  return '****' + key.slice(-4);
}

function aiErrorToStatus(code: string): number {
  switch (code) {
    case 'INVALID_KEY': return 422;
    case 'RATE_LIMITED': return 429;
    case 'MODEL_NOT_FOUND': return 422;
    case 'INVALID_RESPONSE': return 502;
    case 'NETWORK_ERROR': return 502;
    case 'PROVIDER_ERROR': return 502;
    default: return 500;
  }
}

// GET /api/ai/settings — get user's AI config
router.get('/settings', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, provider, api_key, model, endpoint_url FROM user_ai_settings WHERE user_id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      res.json(null);
      return;
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      provider: row.provider,
      apiKey: maskApiKey(decryptApiKey(row.api_key)),
      model: row.model,
      endpointUrl: row.endpoint_url,
    });
  } catch (err) {
    console.error('Get AI settings error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get AI settings' });
  }
});

// PUT /api/ai/settings — upsert AI config
router.put('/settings', async (req, res) => {
  try {
    const { provider, apiKey, model, endpointUrl } = req.body;

    if (!provider || !apiKey || !model) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'provider, apiKey, and model are required' });
      return;
    }

    const validProviders = ['openai', 'anthropic', 'openai-compatible'];
    if (!validProviders.includes(provider)) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Invalid provider' });
      return;
    }

    // If apiKey starts with ****, preserve the existing key
    let finalApiKey = apiKey;
    if (apiKey.startsWith('****')) {
      const existing = await query(
        'SELECT api_key FROM user_ai_settings WHERE user_id = $1',
        [req.user!.id]
      );
      if (existing.rows.length > 0) {
        finalApiKey = decryptApiKey(existing.rows[0].api_key);
      } else {
        res.status(422).json({ error: 'VALIDATION_ERROR', message: 'No existing key to preserve. Please provide a full API key.' });
        return;
      }
    }

    const encryptedKey = encryptApiKey(finalApiKey);

    const result = await query(
      `INSERT INTO user_ai_settings (user_id, provider, api_key, model, endpoint_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         provider = $2, api_key = $3, model = $4, endpoint_url = $5, updated_at = now()
       RETURNING id, provider, api_key, model, endpoint_url`,
      [req.user!.id, provider, encryptedKey, model, endpointUrl || null]
    );

    const row = result.rows[0];
    res.json({
      id: row.id,
      provider: row.provider,
      apiKey: maskApiKey(decryptApiKey(row.api_key)),
      model: row.model,
      endpointUrl: row.endpoint_url,
    });
  } catch (err) {
    console.error('Upsert AI settings error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to save AI settings' });
  }
});

// DELETE /api/ai/settings — remove AI config
router.delete('/settings', async (req, res) => {
  try {
    await query('DELETE FROM user_ai_settings WHERE user_id = $1', [req.user!.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete AI settings error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete AI settings' });
  }
});

// POST /api/ai/analyze-image — analyze raw uploaded image(s) (no stored photo required)
router.post('/analyze-image', memoryUpload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'photos', maxCount: 5 },
]), async (req, res) => {
  try {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const allFiles = [
      ...(files?.photo || []),
      ...(files?.photos || []),
    ].slice(0, 5);

    if (allFiles.length === 0) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'photo file is required (JPEG, PNG, WebP, or GIF, max 5MB)' });
      return;
    }

    // Load user's AI settings
    const settingsResult = await query(
      'SELECT provider, api_key, model, endpoint_url FROM user_ai_settings WHERE user_id = $1',
      [req.user!.id]
    );
    if (settingsResult.rows.length === 0) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'AI not configured. Set up your AI provider first.' });
      return;
    }

    const settings = settingsResult.rows[0];
    const config: AiProviderConfig = {
      provider: settings.provider,
      apiKey: decryptApiKey(settings.api_key),
      model: settings.model,
      endpointUrl: settings.endpoint_url,
    };

    const images: ImageInput[] = allFiles.map((f) => ({
      base64: f.buffer.toString('base64'),
      mimeType: f.mimetype,
    }));

    const suggestions = await analyzeImages(config, images);
    res.json(suggestions);
  } catch (err) {
    if (err instanceof AiAnalysisError) {
      res.status(aiErrorToStatus(err.code)).json({ error: err.message, code: err.code });
      return;
    }
    console.error('AI analyze-image error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to analyze image' });
  }
});

// POST /api/ai/analyze — analyze stored photo(s)
router.post('/analyze', async (req, res) => {
  try {
    const { photoId, photoIds } = req.body;
    // Accept either a single photoId or an array of photoIds
    let ids: string[] = [];
    if (Array.isArray(photoIds) && photoIds.length > 0) {
      ids = photoIds.slice(0, 5);
    } else if (photoId) {
      ids = [photoId];
    }

    if (ids.length === 0) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'photoId or photoIds is required' });
      return;
    }

    // Load user's AI settings
    const settingsResult = await query(
      'SELECT provider, api_key, model, endpoint_url FROM user_ai_settings WHERE user_id = $1',
      [req.user!.id]
    );
    if (settingsResult.rows.length === 0) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'AI not configured. Go to Settings to set up your AI provider.' });
      return;
    }

    const settings = settingsResult.rows[0];
    const config: AiProviderConfig = {
      provider: settings.provider,
      apiKey: decryptApiKey(settings.api_key),
      model: settings.model,
      endpointUrl: settings.endpoint_url,
    };

    // Load and verify access for each photo
    const images: ImageInput[] = [];
    for (const pid of ids) {
      const photoResult = await query(
        `SELECT p.storage_path, p.mime_type FROM photos p
         JOIN bins b ON b.id = p.bin_id
         JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
         WHERE p.id = $1`,
        [pid, req.user!.id]
      );

      if (photoResult.rows.length === 0) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Photo not found or access denied' });
        return;
      }

      const { storage_path, mime_type } = photoResult.rows[0];
      const filePath = path.join(PHOTO_STORAGE_PATH, storage_path);

      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Photo file not found on disk' });
        return;
      }

      const imageBuffer = fs.readFileSync(filePath);
      images.push({
        base64: imageBuffer.toString('base64'),
        mimeType: mime_type,
      });
    }

    const suggestions = await analyzeImages(config, images);
    res.json(suggestions);
  } catch (err) {
    if (err instanceof AiAnalysisError) {
      res.status(aiErrorToStatus(err.code)).json({ error: err.message, code: err.code });
      return;
    }
    console.error('AI analyze error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to analyze photo' });
  }
});

// POST /api/ai/test — test connection with provided credentials
router.post('/test', async (req, res) => {
  try {
    const { provider, apiKey, model, endpointUrl } = req.body;

    if (!provider || !apiKey || !model) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'provider, apiKey, and model are required' });
      return;
    }

    // If apiKey is masked, load the real key
    let finalApiKey = apiKey;
    if (apiKey.startsWith('****')) {
      const existing = await query(
        'SELECT api_key FROM user_ai_settings WHERE user_id = $1',
        [req.user!.id]
      );
      if (existing.rows.length > 0) {
        finalApiKey = decryptApiKey(existing.rows[0].api_key);
      } else {
        res.status(422).json({ error: 'VALIDATION_ERROR', message: 'No saved key found. Please enter your API key.' });
        return;
      }
    }

    const config: AiProviderConfig = {
      provider,
      apiKey: finalApiKey,
      model,
      endpointUrl: endpointUrl || null,
    };

    await testConnection(config);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof AiAnalysisError) {
      res.status(aiErrorToStatus(err.code)).json({ error: err.message, code: err.code });
      return;
    }
    console.error('AI test error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Connection test failed' });
  }
});

export default router;
