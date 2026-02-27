import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { query, generateUuid } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';
import { analyzeImages, testConnection } from '../lib/aiProviders.js';
import type { ImageInput } from '../lib/aiProviders.js';
import { structureText } from '../lib/structureText.js';
import type { StructureTextRequest } from '../lib/structureText.js';
import { parseCommand } from '../lib/commandParser.js';
import type { CommandRequest } from '../lib/commandParser.js';
import { queryInventory } from '../lib/inventoryQuery.js';
import { executeActions } from '../lib/commandExecutor.js';
import { encryptApiKey, decryptApiKey, maskApiKey, resolveMaskedApiKey } from '../lib/crypto.js';
import { getUserAiSettings } from '../lib/aiSettings.js';
import { buildCommandContext, buildInventoryContext, fetchExistingTags } from '../lib/aiContext.js';
import { aiRouteHandler, validateTextInput } from '../lib/aiRouteHandler.js';
import { ALL_DEFAULT_PROMPTS } from '../lib/defaultPrompts.js';
import { config, getEnvAiConfig } from '../lib/config.js';

const router = Router();

// GET /api/ai/default-prompts — public (no auth), returns default prompt strings
router.get('/default-prompts', (_req, res) => {
  res.json(ALL_DEFAULT_PROMPTS);
});

// Rate-limit only endpoints that call external AI providers (not settings CRUD)
// API key requests get a higher limit for headless/smart-home integrations
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: (req: import('express').Request) => (req as any).authMethod === 'api_key' ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many AI requests, please try again later' },
});

const PHOTO_STORAGE_PATH = config.photoStoragePath;
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxPhotoSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.use(authenticate);

// GET /api/ai/settings — get user's AI config
router.get('/settings', aiRouteHandler('get AI settings', async (req, res) => {
  const result = await query(
    'SELECT id, provider, api_key, model, endpoint_url, custom_prompt, command_prompt, query_prompt, structure_prompt, temperature, max_tokens, top_p, request_timeout, is_active FROM user_ai_settings WHERE user_id = $1',
    [req.user!.id]
  );

  if (result.rows.length === 0) {
    // Fall back to env-based AI config
    const envConfig = getEnvAiConfig();
    if (envConfig) {
      res.json({
        id: null,
        provider: envConfig.provider,
        apiKey: maskApiKey(envConfig.apiKey),
        model: envConfig.model,
        endpointUrl: envConfig.endpointUrl,
        customPrompt: null,
        commandPrompt: null,
        queryPrompt: null,
        structurePrompt: null,
        temperature: null,
        maxTokens: null,
        topP: null,
        requestTimeout: null,
        source: 'env' as const,
      });
      return;
    }
    res.json(null);
    return;
  }

  const activeRow = result.rows.find((r: any) => r.is_active === 1) || result.rows[0];

  // Build providerConfigs from all rows
  const providerConfigs: Record<string, { apiKey: string; model: string; endpointUrl: string | null }> = {};
  for (const r of result.rows) {
    providerConfigs[r.provider] = {
      apiKey: maskApiKey(decryptApiKey(r.api_key)),
      model: r.model,
      endpointUrl: r.endpoint_url || null,
    };
  }

  res.json({
    id: activeRow.id,
    provider: activeRow.provider,
    apiKey: maskApiKey(decryptApiKey(activeRow.api_key)),
    model: activeRow.model,
    endpointUrl: activeRow.endpoint_url,
    customPrompt: activeRow.custom_prompt || null,
    commandPrompt: activeRow.command_prompt || null,
    queryPrompt: activeRow.query_prompt || null,
    structurePrompt: activeRow.structure_prompt || null,
    temperature: activeRow.temperature ?? null,
    maxTokens: activeRow.max_tokens ?? null,
    topP: activeRow.top_p ?? null,
    requestTimeout: activeRow.request_timeout ?? null,
    providerConfigs,
    source: 'user' as const,
  });
}));

// PUT /api/ai/settings — upsert AI config
router.put('/settings', aiRouteHandler('save AI settings', async (req, res) => {
  const { provider, apiKey, model, endpointUrl, customPrompt, commandPrompt, queryPrompt, structurePrompt } = req.body;
  const { temperature: rawTemp, maxTokens: rawMaxTokens, topP: rawTopP, requestTimeout: rawTimeout } = req.body;

  if (!provider || !apiKey || !model) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'provider, apiKey, and model are required' });
    return;
  }

  const validProviders = ['openai', 'anthropic', 'gemini', 'openai-compatible'];
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

  if (queryPrompt && typeof queryPrompt === 'string' && queryPrompt.length > 10000) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Query prompt must be 10000 characters or less' });
    return;
  }

  if (structurePrompt && typeof structurePrompt === 'string' && structurePrompt.length > 10000) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Structure prompt must be 10000 characters or less' });
    return;
  }

  // Validate advanced AI parameters
  const finalTemperature = rawTemp != null ? Number(rawTemp) : null;
  if (finalTemperature != null && (isNaN(finalTemperature) || finalTemperature < 0 || finalTemperature > 2)) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'temperature must be between 0 and 2' });
    return;
  }

  const finalMaxTokens = rawMaxTokens != null ? Math.round(Number(rawMaxTokens)) : null;
  if (finalMaxTokens != null && (isNaN(finalMaxTokens) || finalMaxTokens < 100 || finalMaxTokens > 16000)) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'maxTokens must be between 100 and 16000' });
    return;
  }

  const finalTopP = rawTopP != null ? Number(rawTopP) : null;
  if (finalTopP != null && (isNaN(finalTopP) || finalTopP < 0 || finalTopP > 1)) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'topP must be between 0 and 1' });
    return;
  }

  const finalTimeout = rawTimeout != null ? Math.round(Number(rawTimeout)) : null;
  if (finalTimeout != null && (isNaN(finalTimeout) || finalTimeout < 10 || finalTimeout > 300)) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'requestTimeout must be between 10 and 300 seconds' });
    return;
  }

  const finalApiKey = await resolveMaskedApiKey(apiKey, req.user!.id, provider);
  const encryptedKey = encryptApiKey(finalApiKey);
  const finalCustomPrompt = (customPrompt && typeof customPrompt === 'string' && customPrompt.trim()) ? customPrompt.trim() : null;
  const finalCommandPrompt = (commandPrompt && typeof commandPrompt === 'string' && commandPrompt.trim()) ? commandPrompt.trim() : null;
  const finalQueryPrompt = (queryPrompt && typeof queryPrompt === 'string' && queryPrompt.trim()) ? queryPrompt.trim() : null;
  const finalStructurePrompt = (structurePrompt && typeof structurePrompt === 'string' && structurePrompt.trim()) ? structurePrompt.trim() : null;

  // Deactivate all other rows for this user
  await query(
    'UPDATE user_ai_settings SET is_active = 0, updated_at = datetime(\'now\') WHERE user_id = $1',
    [req.user!.id]
  );

  // Upsert the row for this (user, provider) and set it active
  const newId = generateUuid();
  const result = await query(
    `INSERT INTO user_ai_settings (id, user_id, provider, api_key, model, endpoint_url, custom_prompt, command_prompt, query_prompt, structure_prompt, temperature, max_tokens, top_p, request_timeout, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 1)
     ON CONFLICT (user_id, provider) DO UPDATE SET
       api_key = $4, model = $5, endpoint_url = $6, custom_prompt = $7, command_prompt = $8, query_prompt = $9, structure_prompt = $10, temperature = $11, max_tokens = $12, top_p = $13, request_timeout = $14, is_active = 1, updated_at = datetime('now')
     RETURNING id, provider, api_key, model, endpoint_url, custom_prompt, command_prompt, query_prompt, structure_prompt, temperature, max_tokens, top_p, request_timeout`,
    [newId, req.user!.id, provider, encryptedKey, model, endpointUrl || null, finalCustomPrompt, finalCommandPrompt, finalQueryPrompt, finalStructurePrompt, finalTemperature, finalMaxTokens, finalTopP, finalTimeout]
  );

  // Fetch all rows to build providerConfigs
  const allRows = await query(
    'SELECT provider, api_key, model, endpoint_url FROM user_ai_settings WHERE user_id = $1',
    [req.user!.id]
  );
  const providerConfigs: Record<string, { apiKey: string; model: string; endpointUrl: string | null }> = {};
  for (const r of allRows.rows) {
    providerConfigs[r.provider] = {
      apiKey: maskApiKey(decryptApiKey(r.api_key)),
      model: r.model,
      endpointUrl: r.endpoint_url || null,
    };
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
    queryPrompt: row.query_prompt || null,
    structurePrompt: row.structure_prompt || null,
    temperature: row.temperature ?? null,
    maxTokens: row.max_tokens ?? null,
    topP: row.top_p ?? null,
    requestTimeout: row.request_timeout ?? null,
    providerConfigs,
  });
}));

// DELETE /api/ai/settings — remove AI config
router.delete('/settings', aiRouteHandler('delete AI settings', async (req, res) => {
  await query('DELETE FROM user_ai_settings WHERE user_id = $1', [req.user!.id]);
  res.json({ deleted: true });
}));

// POST /api/ai/analyze-image — analyze raw uploaded image(s) (no stored photo required)
router.post('/analyze-image', aiLimiter, memoryUpload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'photos', maxCount: 5 },
]), aiRouteHandler('analyze image', async (req, res) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const allFiles = [
    ...(files?.photo || []),
    ...(files?.photos || []),
  ].slice(0, 5);

  if (allFiles.length === 0) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'photo file is required (JPEG, PNG, WebP, or GIF, max 5MB)' });
    return;
  }

  const settings = await getUserAiSettings(req.user!.id);

  const images: ImageInput[] = allFiles.map((f) => ({
    base64: f.buffer.toString('base64'),
    mimeType: f.mimetype,
  }));

  const locationId = req.body?.locationId;
  const existingTags = locationId ? await fetchExistingTags(locationId) : undefined;

  const suggestions = await analyzeImages(settings.config, images, existingTags, settings.custom_prompt, settings);
  res.json(suggestions);
}));

// POST /api/ai/analyze — analyze stored photo(s)
router.post('/analyze', aiLimiter, aiRouteHandler('analyze photo', async (req, res) => {
  const { photoId, photoIds } = req.body;
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

  const settings = await getUserAiSettings(req.user!.id);

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

  const existingTags = locationId ? await fetchExistingTags(locationId) : undefined;
  const suggestions = await analyzeImages(settings.config, images, existingTags, settings.custom_prompt, settings);
  res.json(suggestions);
}));

// POST /api/ai/structure-text — structure dictated/typed text into items
router.post('/structure-text', aiLimiter, aiRouteHandler('structure text', async (req, res) => {
  const text = validateTextInput(req.body.text, 'text');
  const { mode, context } = req.body;
  const settings = await getUserAiSettings(req.user!.id);

  const request: StructureTextRequest = {
    text,
    mode: mode === 'items' ? 'items' : 'items',
    context: context ? {
      binName: context.binName || undefined,
      existingItems: Array.isArray(context.existingItems) ? context.existingItems : undefined,
    } : undefined,
  };

  const result = await structureText(settings.config, request, settings.structure_prompt || undefined, settings);
  res.json(result);
}));

// POST /api/ai/command — parse natural language command into structured actions
router.post('/command', aiLimiter, requireLocationMember(), aiRouteHandler('parse command', async (req, res) => {
  const text = validateTextInput(req.body.text, 'text');
  const { locationId } = req.body;
  const settings = await getUserAiSettings(req.user!.id);

  const context = await buildCommandContext(locationId, req.user!.id);
  const request: CommandRequest = { text, context };
  const result = await parseCommand(settings.config, request, settings.command_prompt || undefined, settings);
  res.json(result);
}));

// POST /api/ai/query — query inventory with natural language (read-only AI endpoint)
router.post('/query', aiLimiter, requireLocationMember(), aiRouteHandler('query inventory', async (req, res) => {
  const question = validateTextInput(req.body.question, 'question');
  const { locationId } = req.body;
  const settings = await getUserAiSettings(req.user!.id);

  const context = await buildInventoryContext(locationId, req.user!.id);
  const result = await queryInventory(settings.config, question, context, settings.query_prompt || undefined, settings);
  res.json(result);
}));

// POST /api/ai/execute — parse and execute a natural language command server-side
router.post('/execute', aiLimiter, requireLocationMember(), aiRouteHandler('execute command', async (req, res) => {
  const text = validateTextInput(req.body.text, 'text');
  const { locationId } = req.body;
  const settings = await getUserAiSettings(req.user!.id);

  const context = await buildCommandContext(locationId, req.user!.id);
  const request: CommandRequest = { text, context };
  const parsed = await parseCommand(settings.config, request, settings.command_prompt || undefined, settings);

  if (parsed.actions.length === 0) {
    res.json({
      executed: [],
      interpretation: parsed.interpretation,
      errors: [],
    });
    return;
  }

  const result = await executeActions(parsed.actions, locationId, req.user!.id, req.user!.username, req.authMethod, req.apiKeyId);
  res.json({
    executed: result.executed,
    interpretation: parsed.interpretation,
    errors: result.errors,
  });
}));

// POST /api/ai/test — test connection with provided credentials
router.post('/test', aiLimiter, aiRouteHandler('test connection', async (req, res) => {
  const { provider, apiKey, model, endpointUrl } = req.body;

  if (!provider || !apiKey || !model) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'provider, apiKey, and model are required' });
    return;
  }

  const finalApiKey = await resolveMaskedApiKey(apiKey, req.user!.id, provider);
  await testConnection({
    provider,
    apiKey: finalApiKey,
    model,
    endpointUrl: endpointUrl || null,
  });
  res.json({ success: true });
}));

export default router;
