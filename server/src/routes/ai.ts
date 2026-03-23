import { Router } from 'express';
import { generateUuid, query } from '../db.js';
import { testProviderConnection } from '../lib/aiCaller.js';
import { fetchExistingTags } from '../lib/aiContext.js';
import { buildMockAnalysisResult, loadPhotosForAnalysis } from '../lib/aiPhotoLoader.js';
import type { ImageInput } from '../lib/aiProviders.js';
import { analyzeImages, reanalyzeImages } from '../lib/aiProviders.js';
import { aiRouteHandler, validateTextInput } from '../lib/aiRouteHandler.js';
import { getUserAiSettings } from '../lib/aiSettings.js';
import { verifyOptionalLocationMembership } from '../lib/binAccess.js';
import { config, getEnvAiConfig, isDemoUser } from '../lib/config.js';
import { decryptApiKey, encryptApiKey, maskApiKey, resolveMaskedApiKey } from '../lib/crypto.js';
import { ALL_DEFAULT_PROMPTS } from '../lib/defaultPrompts.js';
import { HttpError, ValidationError } from '../lib/httpErrors.js';
import { aiLimiter } from '../lib/rateLimiters.js';
import type { StructureTextRequest } from '../lib/structureText.js';
import { structureText } from '../lib/structureText.js';
import { memoryPhotoUpload } from '../lib/uploadConfig.js';
import { authenticate } from '../middleware/auth.js';

const MOCK_AI_SETTINGS = {
  id: null,
  provider: 'openai',
  apiKey: '***mock',
  model: 'mock',
  endpointUrl: null,
  customPrompt: null,
  commandPrompt: null,
  queryPrompt: null,
  structurePrompt: null,
  reorganizationPrompt: null,
  temperature: null,
  maxTokens: null,
  topP: null,
  requestTimeout: null,
  source: 'env' as const,
} as const;

const router = Router();

// GET /api/ai/default-prompts — public (no auth), returns default prompt strings
router.get('/default-prompts', (_req, res) => {
  res.json(ALL_DEFAULT_PROMPTS);
});

router.use(authenticate);

// GET /api/ai/settings — get user's AI config
router.get('/settings', aiRouteHandler('get AI settings', async (req, res) => {
  const demo = isDemoUser(req);
  const result = await query(
    'SELECT id, provider, api_key, model, endpoint_url, custom_prompt, command_prompt, query_prompt, structure_prompt, reorganization_prompt, temperature, max_tokens, top_p, request_timeout, is_active FROM user_ai_settings WHERE user_id = $1',
    [req.user!.id]
  );

  if (result.rows.length === 0) {
    // Fall back to env-based AI config
    const envConfig = getEnvAiConfig();
    if (envConfig) {
      res.json({
        id: null,
        provider: envConfig.provider,
        apiKey: demo ? 'sk-****' : maskApiKey(envConfig.apiKey),
        model: envConfig.model,
        endpointUrl: envConfig.endpointUrl,
        customPrompt: null,
        commandPrompt: null,
        queryPrompt: null,
        structurePrompt: null,
        reorganizationPrompt: null,
        temperature: null,
        maxTokens: null,
        topP: null,
        requestTimeout: null,
        source: 'env' as const,
      });
      return;
    }
    // In mock mode, return fake settings so the client enables AI features
    if (config.aiMock) {
      res.json(demo ? { ...MOCK_AI_SETTINGS, apiKey: 'sk-****' } : MOCK_AI_SETTINGS);
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
      apiKey: demo ? 'sk-****' : maskApiKey(decryptApiKey(r.api_key)),
      model: r.model,
      endpointUrl: r.endpoint_url || null,
    };
  }

  res.json({
    id: activeRow.id,
    provider: activeRow.provider,
    apiKey: demo ? 'sk-****' : maskApiKey(decryptApiKey(activeRow.api_key)),
    model: activeRow.model,
    endpointUrl: activeRow.endpoint_url,
    customPrompt: activeRow.custom_prompt || null,
    commandPrompt: activeRow.command_prompt || null,
    queryPrompt: activeRow.query_prompt || null,
    structurePrompt: activeRow.structure_prompt || null,
    reorganizationPrompt: activeRow.reorganization_prompt || null,
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
  if (isDemoUser(req)) {
    const isMaskedKey = (k: unknown) => k === '****' || k === 'sk-****';
    const hasApiKey = !!req.body.apiKey && !isMaskedKey(req.body.apiKey);
    const hasProviderApiKey = req.body.providerConfigs
      && Object.values(req.body.providerConfigs).some((c: any) => c?.apiKey && !isMaskedKey(c.apiKey));
    if (hasApiKey || hasProviderApiKey) {
      throw new HttpError(403, 'DEMO_RESTRICTION', 'Demo accounts cannot configure API keys. Use server-configured keys or mock mode.');
    }
    const PROMPT_FIELDS = ['customPrompt', 'commandPrompt', 'queryPrompt', 'structurePrompt', 'reorganizationPrompt'] as const;
    if (PROMPT_FIELDS.some(f => req.body[f] != null)) {
      throw new HttpError(403, 'DEMO_RESTRICTION', 'Demo accounts cannot customize AI prompts');
    }
  }

  const { provider, apiKey, model, endpointUrl, customPrompt, commandPrompt, queryPrompt, structurePrompt, reorganizationPrompt } = req.body;
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

  for (const [field, value] of [['customPrompt', customPrompt], ['commandPrompt', commandPrompt], ['queryPrompt', queryPrompt], ['structurePrompt', structurePrompt], ['reorganizationPrompt', reorganizationPrompt]] as const) {
    if (value && typeof value === 'string' && value.length > 10000) {
      throw new ValidationError(`${field.replace(/([A-Z])/g, ' $1').toLowerCase().trim()} must be 10000 characters or less`);
    }
  }

  // Validate advanced AI parameters
  const finalTemperature = rawTemp != null ? Number(rawTemp) : null;
  if (finalTemperature != null && (Number.isNaN(finalTemperature) || finalTemperature < 0 || finalTemperature > 2)) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'temperature must be between 0 and 2' });
    return;
  }

  const finalMaxTokens = rawMaxTokens != null ? Math.round(Number(rawMaxTokens)) : null;
  if (finalMaxTokens != null && (Number.isNaN(finalMaxTokens) || finalMaxTokens < 100 || finalMaxTokens > 16000)) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'maxTokens must be between 100 and 16000' });
    return;
  }

  const finalTopP = rawTopP != null ? Number(rawTopP) : null;
  if (finalTopP != null && (Number.isNaN(finalTopP) || finalTopP < 0 || finalTopP > 1)) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'topP must be between 0 and 1' });
    return;
  }

  const finalTimeout = rawTimeout != null ? Math.round(Number(rawTimeout)) : null;
  if (finalTimeout != null && (Number.isNaN(finalTimeout) || finalTimeout < 10 || finalTimeout > 300)) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'requestTimeout must be between 10 and 300 seconds' });
    return;
  }

  const finalApiKey = await resolveMaskedApiKey(apiKey, req.user!.id, provider);
  const encryptedKey = encryptApiKey(finalApiKey);
  const finalCustomPrompt = (customPrompt && typeof customPrompt === 'string' && customPrompt.trim()) ? customPrompt.trim() : null;
  const finalCommandPrompt = (commandPrompt && typeof commandPrompt === 'string' && commandPrompt.trim()) ? commandPrompt.trim() : null;
  const finalQueryPrompt = (queryPrompt && typeof queryPrompt === 'string' && queryPrompt.trim()) ? queryPrompt.trim() : null;
  const finalStructurePrompt = (structurePrompt && typeof structurePrompt === 'string' && structurePrompt.trim()) ? structurePrompt.trim() : null;
  const finalReorganizationPrompt = (reorganizationPrompt && typeof reorganizationPrompt === 'string' && reorganizationPrompt.trim()) ? reorganizationPrompt.trim() : null;

  // Deactivate all other rows for this user
  await query(
    'UPDATE user_ai_settings SET is_active = 0, updated_at = datetime(\'now\') WHERE user_id = $1',
    [req.user!.id]
  );

  // Upsert the row for this (user, provider) and set it active
  const newId = generateUuid();
  const result = await query(
    `INSERT INTO user_ai_settings (id, user_id, provider, api_key, model, endpoint_url, custom_prompt, command_prompt, query_prompt, structure_prompt, reorganization_prompt, temperature, max_tokens, top_p, request_timeout, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 1)
     ON CONFLICT (user_id, provider) DO UPDATE SET
       api_key = $4, model = $5, endpoint_url = $6, custom_prompt = $7, command_prompt = $8, query_prompt = $9, structure_prompt = $10, reorganization_prompt = $11, temperature = $12, max_tokens = $13, top_p = $14, request_timeout = $15, is_active = 1, updated_at = datetime('now')
     RETURNING id, provider, api_key, model, endpoint_url, custom_prompt, command_prompt, query_prompt, structure_prompt, reorganization_prompt, temperature, max_tokens, top_p, request_timeout`,
    [newId, req.user!.id, provider, encryptedKey, model, endpointUrl || null, finalCustomPrompt, finalCommandPrompt, finalQueryPrompt, finalStructurePrompt, finalReorganizationPrompt, finalTemperature, finalMaxTokens, finalTopP, finalTimeout]
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
    reorganizationPrompt: row.reorganization_prompt || null,
    temperature: row.temperature ?? null,
    maxTokens: row.max_tokens ?? null,
    topP: row.top_p ?? null,
    requestTimeout: row.request_timeout ?? null,
    providerConfigs,
    source: 'user' as const,
  });
}));

// DELETE /api/ai/settings — remove AI config
router.delete('/settings', aiRouteHandler('delete AI settings', async (req, res) => {
  await query('DELETE FROM user_ai_settings WHERE user_id = $1', [req.user!.id]);
  res.json({ deleted: true });
}));

// POST /api/ai/analyze-image — analyze raw uploaded image(s) (no stored photo required)
router.post('/analyze-image', memoryPhotoUpload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'photos', maxCount: 5 },
]), aiLimiter, aiRouteHandler('analyze image', async (req, res) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const allFiles = [
    ...(files?.photo || []),
    ...(files?.photos || []),
  ].slice(0, 5);

  if (allFiles.length === 0) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'photo file is required (JPEG, PNG, WebP, or GIF, max 5MB)' });
    return;
  }

  // Mock mode: return fake AI response without calling any provider
  if (config.aiMock) {
    res.json(buildMockAnalysisResult());
    return;
  }

  const settings = await getUserAiSettings(req.user!.id);

  const images: ImageInput[] = allFiles.map((f) => ({
    base64: f.buffer.toString('base64'),
    mimeType: f.mimetype,
  }));

  const locationId = req.body?.locationId;
  if (!await verifyOptionalLocationMembership(locationId, req.user!.id)) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
    return;
  }
  const existingTags = locationId ? await fetchExistingTags(locationId) : undefined;

  const suggestions = await analyzeImages(settings.config, images, existingTags, settings.custom_prompt, settings, isDemoUser(req));
  res.json(suggestions);
}));

// POST /api/ai/analyze — analyze stored photo(s)
router.post('/analyze', aiLimiter, aiRouteHandler('analyze photo', async (req, res) => {
  const { photoId, photoIds } = req.body;
  let ids: string[] = [];
  if (Array.isArray(photoIds) && photoIds.length > 0) {
    ids = photoIds.filter((id: unknown): id is string => typeof id === 'string').slice(0, 5);
  } else if (typeof photoId === 'string') {
    ids = [photoId];
  }

  if (ids.length === 0) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'photoId or photoIds is required' });
    return;
  }

  // Mock mode: return fake AI response without calling any provider
  if (config.aiMock) {
    res.json(buildMockAnalysisResult());
    return;
  }

  const settings = await getUserAiSettings(req.user!.id);

  const loaded = await loadPhotosForAnalysis(ids, req.user!.id);
  if (!loaded) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Photo not found or access denied' });
    return;
  }

  const images: ImageInput[] = loaded.images.map((img) => ({
    base64: img.buffer.toString('base64'),
    mimeType: img.mimeType,
  }));

  const suggestions = await analyzeImages(settings.config, images, loaded.existingTags, settings.custom_prompt, settings, isDemoUser(req));
  res.json(suggestions);
}));

// POST /api/ai/reanalyze — reanalyze stored photo(s) with previous result context
router.post('/reanalyze', aiLimiter, aiRouteHandler('reanalyze photo', async (req, res) => {
  const { photoIds, previousResult: rawPrev } = req.body;

  if (
    !rawPrev ||
    typeof rawPrev !== 'object' ||
    typeof rawPrev.name !== 'string' ||
    !Array.isArray(rawPrev.items)
  ) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'previousResult must have name (string) and items (array)' });
    return;
  }

  const previousResult = rawPrev;

  let ids: string[] = [];
  if (Array.isArray(photoIds) && photoIds.length > 0) {
    ids = photoIds.filter((id: unknown): id is string => typeof id === 'string').slice(0, 5);
  }

  if (ids.length === 0) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'photoIds is required' });
    return;
  }

  if (config.aiMock) {
    res.json(buildMockAnalysisResult());
    return;
  }

  const settings = await getUserAiSettings(req.user!.id);

  const loaded = await loadPhotosForAnalysis(ids, req.user!.id);
  if (!loaded) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Photo not found or access denied' });
    return;
  }

  const images: ImageInput[] = loaded.images.map((img) => ({
    base64: img.buffer.toString('base64'),
    mimeType: img.mimeType,
  }));

  const suggestions = await reanalyzeImages(settings.config, images, previousResult, loaded.existingTags, loaded.customFieldDefs, settings, isDemoUser(req));
  res.json(suggestions);
}));

// POST /api/ai/structure-text — structure dictated/typed text into items
router.post('/structure-text', aiLimiter, aiRouteHandler('structure text', async (req, res) => {
  const text = validateTextInput(req.body.text, 'text');
  const { context } = req.body;

  // Mock mode: return fake AI response without calling any provider
  if (config.aiMock) {
    res.json({ items: [text] });
    return;
  }

  const settings = await getUserAiSettings(req.user!.id);

  const request: StructureTextRequest = {
    text,
    mode: 'items',
    context: context ? {
      binName: context.binName || undefined,
      existingItems: Array.isArray(context.existingItems) ? context.existingItems : undefined,
    } : undefined,
  };

  const result = await structureText(settings.config, request, settings.structure_prompt || undefined, settings, isDemoUser(req));
  res.json(result);
}));

// POST /api/ai/test — test connection with provided credentials
router.post('/test', aiLimiter, aiRouteHandler('test connection', async (req, res) => {
  if (isDemoUser(req)) {
    throw new HttpError(403, 'DEMO_RESTRICTION', 'Demo accounts cannot configure API keys. Use server-configured keys or mock mode.');
  }

  const { provider, apiKey, model, endpointUrl } = req.body;

  if (!provider || !apiKey || !model) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'provider, apiKey, and model are required' });
    return;
  }

  // Mock mode: return success without calling any provider
  if (config.aiMock) {
    res.json({ success: true });
    return;
  }

  const finalApiKey = await resolveMaskedApiKey(apiKey, req.user!.id, provider);
  await testProviderConnection({
    provider,
    apiKey: finalApiKey,
    model,
    endpointUrl: endpointUrl || null,
  }, isDemoUser(req));
  res.json({ success: true });
}));

export default router;
