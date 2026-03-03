import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { generateUuid, query } from '../db.js';
import { buildCommandContext, buildInventoryContext, fetchExistingTags } from '../lib/aiContext.js';
import type { ImageInput } from '../lib/aiProviders.js';
import { analyzeImages, testConnection } from '../lib/aiProviders.js';
import { aiRouteHandler, validateTextInput } from '../lib/aiRouteHandler.js';
import { getUserAiSettings } from '../lib/aiSettings.js';
import type { ChatMessage } from '../lib/aiStreamingCaller.js';
import { callAiProviderStreaming, consumeGeminiRawParts } from '../lib/aiStreamingCaller.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { executeCreateArea, executeReadOnlyTool, executeWriteActions, getChatToolDefinitions, isReadOnlyTool, toolCallToCommandAction } from '../lib/chatTools.js';
import { executeActions } from '../lib/commandExecutor.js';
import type { CommandRequest } from '../lib/commandParser.js';
import { parseCommand } from '../lib/commandParser.js';
import { config, getEnvAiConfig } from '../lib/config.js';
import { decryptApiKey, encryptApiKey, maskApiKey, resolveMaskedApiKey } from '../lib/crypto.js';
import { ALL_DEFAULT_PROMPTS } from '../lib/defaultPrompts.js';
import { queryInventory } from '../lib/inventoryQuery.js';
import type { StructureTextRequest } from '../lib/structureText.js';
import { structureText } from '../lib/structureText.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';

const router = Router();

// GET /api/ai/default-prompts — public (no auth), returns default prompt strings
router.get('/default-prompts', (_req, res) => {
  res.json(ALL_DEFAULT_PROMPTS);
});

// Rate-limit only endpoints that call external AI providers (not settings CRUD)
// API key requests get a higher limit for headless/smart-home integrations
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: (req: import('express').Request) => req.authMethod === 'api_key' ? config.aiRateLimitApiKey : config.aiRateLimit,
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

// ---------------------------------------------------------------------------
// Streaming Chat with Tool Calling
// ---------------------------------------------------------------------------

/** In-memory store for pending write-action confirmations */
const pendingConfirmations = new Map<string, { userId: string; resolve: (accepted: boolean) => void; timeout: ReturnType<typeof setTimeout> }>();

/** Build a human-readable description of a tool call for action previews */
function describeToolCall(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'create_bin':
      return `Create bin "${args.name}"${args.area_name ? ` in ${args.area_name}` : ''}`;
    case 'update_bin':
      return `Update bin "${args.bin_name}"`;
    case 'delete_bin':
      return `Delete bin "${args.bin_name}"`;
    case 'add_items':
      return `Add ${(args.items as string[])?.length ?? 0} item(s) to "${args.bin_name}"`;
    case 'remove_items':
      return `Remove ${(args.items as string[])?.length ?? 0} item(s) from "${args.bin_name}"`;
    case 'set_area':
      return `Move "${args.bin_name}" to ${args.area_name}`;
    case 'add_tags':
      return `Add tags [${(args.tags as string[])?.join(', ')}] to "${args.bin_name}"`;
    case 'remove_tags':
      return `Remove tags [${(args.tags as string[])?.join(', ')}] from "${args.bin_name}"`;
    case 'create_area':
      return `Create area "${args.name}"`;
    default:
      return `${name} on "${args.bin_name || args.name}"`;
  }
}

/** Send an SSE event to the response stream */
function sendSSE(res: import('express').Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// POST /api/ai/chat — streaming chat with tool calling
router.post('/chat', aiLimiter, requireLocationMember(), aiRouteHandler('chat', async (req, res) => {
  const { messages: clientMessages, locationId } = req.body;

  // Validate inputs
  if (!Array.isArray(clientMessages) || clientMessages.length === 0) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'messages array is required and must not be empty' });
    return;
  }
  if (clientMessages.length > 100) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Too many messages (max 100)' });
    return;
  }
  if (!locationId || typeof locationId !== 'string') {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'locationId is required' });
    return;
  }

  // Get user AI settings
  const settings = await getUserAiSettings(req.user!.id);

  // Query location context for system prompt
  const [locationResult, areasResult, tagsResult] = await Promise.all([
    query('SELECT name, term_bin, term_location, term_area FROM locations WHERE id = $1', [locationId]),
    query('SELECT name FROM areas WHERE location_id = $1 ORDER BY name COLLATE NOCASE ASC', [locationId]),
    query(
      `SELECT DISTINCT je.value AS tag FROM bins, json_each(bins.tags) je WHERE bins.location_id = $1 AND bins.deleted_at IS NULL ORDER BY je.value COLLATE NOCASE ASC`,
      [locationId],
    ),
  ]);

  if (locationResult.rows.length === 0) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Location not found' });
    return;
  }

  const loc = locationResult.rows[0];
  const locationName = loc.name as string;
  const termBin = (loc.term_bin as string) || 'bin';
  const termLocation = (loc.term_location as string) || 'location';
  const termArea = (loc.term_area as string) || 'area';
  const areaNames = areasResult.rows.map((r) => r.name as string);
  const tagNames = tagsResult.rows.map((r) => r.tag as string);

  // Build system prompt
  const systemPrompt = `You are the OpenBin assistant. You help users manage their physical storage inventory.
You have access to tools to search, create, and modify ${termBin}s, items, ${termArea}s, and tags.

Current ${termLocation}: ${locationName}
Available ${termArea}s: ${areaNames.length > 0 ? areaNames.join(', ') : 'none yet'}
Existing tags: ${tagNames.length > 0 ? tagNames.join(', ') : 'none yet'}
Terminology: "${termBin}" means a storage container, "${termArea}" means a room or zone, "${termLocation}" means the overall space.

Guidelines:
- Use search tools before making changes to verify you're acting on the right ${termBin}s.
- When suggesting changes, be specific about what will change.
- After completing actions, summarize what was done.
- If the user's request is ambiguous, ask for clarification.
- Keep responses concise and helpful.`;

  // Convert client messages to provider format (ChatMessage[])
  const providerMessages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

  for (const msg of clientMessages) {
    if (msg.role === 'user') {
      providerMessages.push({ role: 'user', content: msg.content ?? '' });
    } else if (msg.role === 'assistant') {
      const chatMsg: ChatMessage = { role: 'assistant' };
      if (msg.content) chatMsg.content = msg.content;
      if (Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) {
        chatMsg.tool_calls = msg.toolCalls.map((tc: { id: string; name: string; arguments: Record<string, unknown> }) => ({
          id: tc.id,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }));
      }
      providerMessages.push(chatMsg);
    } else if (msg.role === 'tool') {
      providerMessages.push({
        role: 'tool',
        content: msg.content ?? '',
        tool_call_id: msg.toolCallId,
      });
    }
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Abort on client disconnect
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  const tools = getChatToolDefinitions();
  const userId = req.user!.id;
  const userName = req.user!.username;
  const authMethod = req.authMethod;
  const apiKeyId = req.apiKeyId;

  const MAX_ITERATIONS = 10;

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      if (abortController.signal.aborted) break;

      // Call AI provider with streaming
      const stream = callAiProviderStreaming({
        config: settings.config,
        messages: providerMessages,
        tools,
        temperature: settings.temperature ?? undefined,
        maxTokens: settings.max_tokens ?? undefined,
        topP: settings.top_p ?? undefined,
        timeoutMs: (settings.request_timeout ?? 120) * 1000,
        signal: abortController.signal,
      });

      const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
      let assistantText = '';

      for await (const event of stream) {
        if (event.type === 'text_delta') {
          assistantText += event.delta;
          sendSSE(res, 'text_delta', { delta: event.delta });
        } else if (event.type === 'tool_call') {
          toolCalls.push({ id: event.id, name: event.name, arguments: event.arguments });
        } else if (event.type === 'error') {
          sendSSE(res, 'error', { message: event.message, code: event.code });
          sendSSE(res, 'done', {});
          res.end();
          return;
        }
        // 'done' from provider stream is handled after loop
      }

      // No tool calls — we're done
      if (toolCalls.length === 0) {
        sendSSE(res, 'done', {});
        res.end();
        return;
      }

      // Add assistant message with tool calls to history
      const assistantMsg: ChatMessage = { role: 'assistant' };
      if (assistantText) assistantMsg.content = assistantText;
      assistantMsg.tool_calls = toolCalls.map((tc) => ({
        id: tc.id,
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      }));
      // For Gemini: attach raw response parts to preserve thoughtSignature
      if (settings.config.provider === 'gemini') {
        assistantMsg._geminiParts = consumeGeminiRawParts();
      }
      providerMessages.push(assistantMsg);

      // Separate read-only vs write tool calls
      const readCalls: typeof toolCalls = [];
      const writeCalls: typeof toolCalls = [];

      for (const tc of toolCalls) {
        if (isReadOnlyTool(tc.name)) {
          readCalls.push(tc);
        } else {
          writeCalls.push(tc);
        }
      }

      // Execute read-only tools immediately
      for (const tc of readCalls) {
        const result = await executeReadOnlyTool(tc.name, tc.arguments, locationId, userId);
        sendSSE(res, 'tool_result', { toolCallId: tc.id, name: tc.name, result });
        providerMessages.push({ role: 'tool', content: result, tool_call_id: tc.id, name: tc.name });
      }

      // Handle write tool calls — need user confirmation
      if (writeCalls.length > 0) {
        const confirmationId = crypto.randomUUID();
        const actions: Array<{ id: string; toolName: string; args: Record<string, unknown>; description: string }> = [];

        for (const tc of writeCalls) {
          actions.push({
            id: tc.id,
            toolName: tc.name,
            args: tc.arguments,
            description: describeToolCall(tc.name, tc.arguments),
          });
        }

        sendSSE(res, 'action_preview', { confirmationId, actions });

        // Wait for user confirmation with 5-minute timeout
        const accepted = await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => {
            pendingConfirmations.delete(confirmationId);
            resolve(false);
          }, 5 * 60 * 1000);
          pendingConfirmations.set(confirmationId, { userId, resolve, timeout });
        });

        if (accepted) {
          // Execute each write tool call
          for (const tc of writeCalls) {
            try {
              let resultText: string;

              if (tc.name === 'create_area') {
                resultText = await executeCreateArea(tc.arguments, locationId, userId);
              } else {
                const action = toolCallToCommandAction(tc.name, tc.arguments);
                if (!action) {
                  resultText = JSON.stringify({ error: `Could not convert ${tc.name} to action` });
                } else {
                  const execResult = await executeWriteActions([action], locationId, userId, userName, authMethod, apiKeyId);
                  const actionResult = execResult.executed[0];
                  resultText = JSON.stringify(actionResult ?? { error: 'No result' });
                }
              }

              sendSSE(res, 'action_executed', { toolCallId: tc.id, success: true, details: resultText });
              providerMessages.push({ role: 'tool', content: resultText, tool_call_id: tc.id, name: tc.name });
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : 'Unknown error';
              const errorResult = JSON.stringify({ error: errorMsg });
              sendSSE(res, 'action_executed', { toolCallId: tc.id, success: false, details: errorResult });
              providerMessages.push({ role: 'tool', content: errorResult, tool_call_id: tc.id, name: tc.name });
            }
          }
        } else {
          // Rejected or timed out
          sendSSE(res, 'action_rejected', { confirmationId });
          for (const tc of writeCalls) {
            const rejectionResult = JSON.stringify({ error: 'Action rejected by user' });
            providerMessages.push({ role: 'tool', content: rejectionResult, tool_call_id: tc.id, name: tc.name });
          }
        }
      }

      // Continue loop — AI will generate follow-up based on tool results
    }

    // Exceeded max iterations
    sendSSE(res, 'error', { message: 'Maximum tool-calling iterations reached', code: 'MAX_ITERATIONS' });
    sendSSE(res, 'done', {});
    res.end();
  } catch (err) {
    // If headers already sent (streaming started), send as SSE error event
    const message = err instanceof Error ? err.message : 'Internal server error';
    sendSSE(res, 'error', { message, code: 'INTERNAL_ERROR' });
    sendSSE(res, 'done', {});
    res.end();
  }
}));

// POST /api/ai/chat/confirm — confirm or reject pending write actions
router.post('/chat/confirm', asyncHandler(async (req, res) => {
  const { confirmationId, accepted } = req.body;

  if (!confirmationId || typeof confirmationId !== 'string') {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'confirmationId is required' });
    return;
  }
  if (typeof accepted !== 'boolean') {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'accepted must be a boolean' });
    return;
  }

  const pending = pendingConfirmations.get(confirmationId);
  if (!pending) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Confirmation not found or already expired' });
    return;
  }

  if (pending.userId !== req.user!.id) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to confirm this action' });
    return;
  }

  clearTimeout(pending.timeout);
  pendingConfirmations.delete(confirmationId);
  pending.resolve(accepted);

  res.json({ ok: true });
}));

export default router;
