import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { query, generateUuid } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { analyzeImage, analyzeImages, testConnection, AiAnalysisError } from '../lib/aiProviders.js';
import type { AiProviderConfig, ImageInput } from '../lib/aiProviders.js';
import { structureText } from '../lib/structureText.js';
import type { StructureTextRequest } from '../lib/structureText.js';
import { parseCommand } from '../lib/commandParser.js';
import type { CommandRequest } from '../lib/commandParser.js';

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
      'SELECT id, provider, api_key, model, endpoint_url, custom_prompt, command_prompt FROM user_ai_settings WHERE user_id = $1',
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
      customPrompt: row.custom_prompt || null,
      commandPrompt: row.command_prompt || null,
    });
  } catch (err) {
    console.error('Get AI settings error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get AI settings' });
  }
});

// PUT /api/ai/settings — upsert AI config
router.put('/settings', async (req, res) => {
  try {
    const { provider, apiKey, model, endpointUrl, customPrompt, commandPrompt } = req.body;

    if (!provider || !apiKey || !model) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'provider, apiKey, and model are required' });
      return;
    }

    const validProviders = ['openai', 'anthropic', 'openai-compatible'];
    if (!validProviders.includes(provider)) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Invalid provider' });
      return;
    }

    if (customPrompt && typeof customPrompt === 'string' && customPrompt.length > 10000) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Custom prompt must be 10000 characters or less' });
      return;
    }

    if (commandPrompt && typeof commandPrompt === 'string' && commandPrompt.length > 10000) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Command prompt must be 10000 characters or less' });
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
    const finalCustomPrompt = (customPrompt && typeof customPrompt === 'string' && customPrompt.trim()) ? customPrompt.trim() : null;
    const finalCommandPrompt = (commandPrompt && typeof commandPrompt === 'string' && commandPrompt.trim()) ? commandPrompt.trim() : null;

    const newId = generateUuid();
    const result = await query(
      `INSERT INTO user_ai_settings (id, user_id, provider, api_key, model, endpoint_url, custom_prompt, command_prompt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         provider = $3, api_key = $4, model = $5, endpoint_url = $6, custom_prompt = $7, command_prompt = $8, updated_at = datetime('now')
       RETURNING id, provider, api_key, model, endpoint_url, custom_prompt, command_prompt`,
      [newId, req.user!.id, provider, encryptedKey, model, endpointUrl || null, finalCustomPrompt, finalCommandPrompt]
    );

    const row = result.rows[0];
    res.json({
      id: row.id,
      provider: row.provider,
      apiKey: maskApiKey(decryptApiKey(row.api_key)),
      model: row.model,
      endpointUrl: row.endpoint_url,
      customPrompt: row.custom_prompt || null,
      commandPrompt: row.command_prompt || null,
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
      'SELECT provider, api_key, model, endpoint_url, custom_prompt FROM user_ai_settings WHERE user_id = $1',
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

    // Fetch existing tags from the location for tag reuse
    const locationId = req.body?.locationId;
    let existingTags: string[] | undefined;
    if (locationId) {
      const tagsResult = await query(
        `SELECT DISTINCT je.value AS tag FROM bins, json_each(bins.tags) je WHERE bins.location_id = $1 AND bins.deleted_at IS NULL`,
        [locationId]
      );
      existingTags = tagsResult.rows.map((r) => r.tag as string).sort();
    }

    const suggestions = await analyzeImages(config, images, existingTags, settings.custom_prompt);
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
      'SELECT provider, api_key, model, endpoint_url, custom_prompt FROM user_ai_settings WHERE user_id = $1',
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
    let locationId: string | null = null;
    for (const pid of ids) {
      const photoResult = await query(
        `SELECT p.storage_path, p.mime_type, b.location_id FROM photos p
         JOIN bins b ON b.id = p.bin_id
         JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
         WHERE p.id = $1`,
        [pid, req.user!.id]
      );

      if (photoResult.rows.length === 0) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Photo not found or access denied' });
        return;
      }

      const { storage_path, mime_type, location_id } = photoResult.rows[0];
      if (!locationId) locationId = location_id;
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

    // Fetch existing tags from the location for tag reuse
    let existingTags: string[] | undefined;
    if (locationId) {
      const tagsResult = await query(
        `SELECT DISTINCT je.value AS tag FROM bins, json_each(bins.tags) je WHERE bins.location_id = $1 AND bins.deleted_at IS NULL`,
        [locationId]
      );
      existingTags = tagsResult.rows.map((r) => r.tag as string).sort();
    }

    const suggestions = await analyzeImages(config, images, existingTags, settings.custom_prompt);
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

// POST /api/ai/structure-text — structure dictated/typed text into items
router.post('/structure-text', async (req, res) => {
  try {
    const { text, mode, context, locationId } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'text is required' });
      return;
    }

    if (text.length > 5000) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'text must be 5000 characters or less' });
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

    const request: StructureTextRequest = {
      text: text.trim(),
      mode: mode === 'items' ? 'items' : 'items',
      context: context ? {
        binName: context.binName || undefined,
        existingItems: Array.isArray(context.existingItems) ? context.existingItems : undefined,
      } : undefined,
    };

    const result = await structureText(config, request);
    res.json(result);
  } catch (err) {
    if (err instanceof AiAnalysisError) {
      res.status(aiErrorToStatus(err.code)).json({ error: err.message, code: err.code });
      return;
    }
    console.error('AI structure-text error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to structure text' });
  }
});

// POST /api/ai/command — parse natural language command into structured actions
router.post('/command', async (req, res) => {
  try {
    const { text, locationId } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'text is required' });
      return;
    }

    if (text.length > 5000) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'text must be 5000 characters or less' });
      return;
    }

    if (!locationId || typeof locationId !== 'string') {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'locationId is required' });
      return;
    }

    // Verify location membership
    const memberCheck = await query(
      'SELECT 1 FROM location_members WHERE location_id = $1 AND user_id = $2',
      [locationId, req.user!.id]
    );
    if (memberCheck.rows.length === 0) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
      return;
    }

    // Load user's AI settings
    const settingsResult = await query(
      'SELECT provider, api_key, model, endpoint_url, command_prompt FROM user_ai_settings WHERE user_id = $1',
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

    // Fetch bins for context
    const binsResult = await query(
      `SELECT b.id, b.name, b.items, b.tags, b.area_id, COALESCE(a.name, '') AS area_name, b.notes, b.icon, b.color, b.short_code
       FROM bins b
       LEFT JOIN areas a ON a.id = b.area_id
       WHERE b.location_id = $1 AND b.deleted_at IS NULL`,
      [locationId]
    );

    // Fetch areas for context
    const areasResult = await query(
      'SELECT id, name FROM areas WHERE location_id = $1',
      [locationId]
    );

    const bins = binsResult.rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      items: r.items as string[],
      tags: r.tags as string[],
      area_id: r.area_id as string | null,
      area_name: r.area_name as string,
      notes: typeof r.notes === 'string' && r.notes.length > 200 ? r.notes.slice(0, 200) + '...' : (r.notes as string || ''),
      icon: r.icon as string,
      color: r.color as string,
      short_code: r.short_code as string,
    }));

    const areas = areasResult.rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
    }));

    // Import color and icon lists inline to avoid circular deps
    const availableColors = ['red', 'orange', 'amber', 'lime', 'green', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'purple', 'rose', 'pink', 'gray'];
    const availableIcons = [
      'Package', 'Box', 'Archive', 'Wrench', 'Shirt', 'Book', 'Utensils', 'Laptop', 'Camera', 'Music',
      'Heart', 'Star', 'Home', 'Car', 'Bike', 'Plane', 'Briefcase', 'ShoppingBag', 'Gift', 'Lightbulb',
      'Scissors', 'Hammer', 'Paintbrush', 'Leaf', 'Apple', 'Coffee', 'Wine', 'Baby', 'Dog', 'Cat',
    ];

    const request: CommandRequest = {
      text: text.trim(),
      context: { bins, areas, availableColors, availableIcons },
    };

    const result = await parseCommand(config, request, settings.command_prompt || undefined);
    res.json(result);
  } catch (err) {
    if (err instanceof AiAnalysisError) {
      res.status(aiErrorToStatus(err.code)).json({ error: err.message, code: err.code });
      return;
    }
    console.error('AI command error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to parse command' });
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
