import { Router } from 'express';
import { validateEndpointUrl } from '../lib/aiCaller.js';
import { buildCommandContext, buildInventoryContext, fetchExistingTags } from '../lib/aiContext.js';
import { buildMockAnalysisResult, loadPhotosForAnalysis } from '../lib/aiPhotoLoader.js';
import { buildSystemPrompt as buildAnalysisPrompt, buildAnalysisUserText, buildCorrectionPrompt } from '../lib/aiProviders.js';
import { aiRouteHandler, validateTextInput } from '../lib/aiRouteHandler.js';
import { QueryResultSchema } from '../lib/aiSchemas.js';
import type { UserAiSettings } from '../lib/aiSettings.js';
import { getUserAiSettings } from '../lib/aiSettings.js';
import { initSseResponse, pipeAiStreamToResponse } from '../lib/aiStream.js';
import { verifyOptionalLocationMembership } from '../lib/binAccess.js';
import type { CommandRequest } from '../lib/commandParser.js';
import { buildSystemPrompt as buildCommandSysPrompt, buildUserMessage as buildCommandUserMsg, buildUnifiedSystemPrompt } from '../lib/commandParser.js';
import { config } from '../lib/config.js';
import { fetchCustomFieldDefs } from '../lib/customFieldHelpers.js';
import { buildSystemPrompt as buildQuerySysPrompt, buildUserMessage as buildQueryUserMsg } from '../lib/inventoryQuery.js';
import { aiLimiter } from '../lib/rateLimiters.js';
import { createSdkModel } from '../lib/sdkProviderFactory.js';
import { buildPrompt as buildStructurePrompt } from '../lib/structureText.js';
import { memoryPhotoUpload } from '../lib/uploadConfig.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';

const streamRouter = Router();
streamRouter.use(authenticate);

/** Fetch existing tags and custom field definitions for a location (used by analysis/correction routes). */
async function fetchLocationAiMeta(locationId: string | undefined) {
  const [existingTags, customFieldDefs] = await Promise.all([
    locationId ? fetchExistingTags(locationId) : Promise.resolve(undefined),
    locationId ? fetchCustomFieldDefs(locationId) : Promise.resolve(undefined),
  ]);
  return { existingTags, customFieldDefs };
}

/** Stream a JSON object as fake SSE chunks (mock mode). */
async function sendMockJsonStream(res: import('express').Response, data: object): Promise<void> {
  const writeEvent = initSseResponse(res);
  const json = JSON.stringify(data);
  const chunkSize = 20;
  for (let i = 0; i < json.length; i += chunkSize) {
    writeEvent({ type: 'delta', text: json.slice(i, i + chunkSize) });
    await new Promise((r) => setTimeout(r, 5));
  }
  writeEvent({ type: 'done', text: json });
  res.end();
}

/** Resolve a user's AI model (settings + SSRF check + SDK model). */
async function resolveUserModel(userId: string) {
  const settings = await getUserAiSettings(userId);
  if (settings.config.endpointUrl) await validateEndpointUrl(settings.config.endpointUrl);
  const model = createSdkModel(settings.config);
  return { settings, model };
}

/** Build common StreamOptions from user AI settings. */
function streamOpts(settings: UserAiSettings, overrides?: { maxTokens?: number; temperature?: number }) {
  return {
    maxTokens: overrides?.maxTokens ?? settings.max_tokens ?? 2000,
    temperature: overrides?.temperature ?? settings.temperature ?? 0.3,
    topP: settings.top_p ?? undefined,
    abortSignal: settings.request_timeout
      ? AbortSignal.timeout(settings.request_timeout * 1000)
      : undefined,
  };
}

// POST /api/ai/query/stream
streamRouter.post('/query/stream', aiLimiter, requireLocationMember(), aiRouteHandler('stream query', async (req, res) => {
  const question = validateTextInput(req.body.question, 'question');
  const { locationId } = req.body;
  const [{ settings, model }, context] = await Promise.all([
    resolveUserModel(req.user!.id),
    buildInventoryContext(locationId, req.user!.id),
  ]);

  await pipeAiStreamToResponse(res, model, {
    schema: QueryResultSchema,
    system: buildQuerySysPrompt(settings.query_prompt ?? undefined),
    userContent: buildQueryUserMsg(question, context),
    ...streamOpts(settings, { maxTokens: Math.max(settings.max_tokens ?? 4096, 4096) }),
  });
}));

// POST /api/ai/command/stream
streamRouter.post('/command/stream', aiLimiter, requireLocationMember(), aiRouteHandler('stream command', async (req, res) => {
  const text = validateTextInput(req.body.text, 'text');
  const { locationId } = req.body;
  const [{ settings, model }, context] = await Promise.all([
    resolveUserModel(req.user!.id),
    buildCommandContext(locationId, req.user!.id),
  ]);
  const request: CommandRequest = { text, context };

  // No schema constraint — the prompt's examples and instructions produce
  // reliable JSON, and structured-output mode causes providers like Gemini
  // to aggressively omit optional fields (items, area_name in create_bin).
  await pipeAiStreamToResponse(res, model, {
    system: buildCommandSysPrompt(request, settings.command_prompt ?? undefined),
    userContent: buildCommandUserMsg(request),
    ...streamOpts(settings, { temperature: 0.2 }),
  });
}));

// POST /api/ai/ask/stream — unified command+query endpoint
streamRouter.post('/ask/stream', aiLimiter, requireLocationMember(), aiRouteHandler('stream ask', async (req, res) => {
  const text = validateTextInput(req.body.text, 'text');
  const { locationId } = req.body;
  const [{ settings, model }, context] = await Promise.all([
    resolveUserModel(req.user!.id),
    buildCommandContext(locationId, req.user!.id),
  ]);
  const request: CommandRequest = { text, context };

  await pipeAiStreamToResponse(res, model, {
    system: buildUnifiedSystemPrompt(request, settings.command_prompt ?? undefined, settings.query_prompt ?? undefined),
    userContent: buildCommandUserMsg(request),
    ...streamOpts(settings, { temperature: 0.2 }),
  });
}));

// POST /api/ai/structure-text/stream
streamRouter.post('/structure-text/stream', aiLimiter, aiRouteHandler('stream structure-text', async (req, res) => {
  const text = validateTextInput(req.body.text, 'text');
  const { context } = req.body;
  const { settings, model } = await resolveUserModel(req.user!.id);

  await pipeAiStreamToResponse(res, model, {
    system: buildStructurePrompt({ text, mode: 'items', context }, settings.structure_prompt ?? undefined),
    userContent: text,
    ...streamOpts(settings, { maxTokens: 800, temperature: 0.2 }),
  });
}));

// POST /api/ai/analyze-image/stream
streamRouter.post('/analyze-image/stream', aiLimiter, memoryPhotoUpload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'photos', maxCount: 5 },
]), aiRouteHandler('stream analyze image', async (req, res) => {
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
  if (config.aiMock) { await sendMockJsonStream(res, buildMockAnalysisResult()); return; }

  const { settings, model } = await resolveUserModel(req.user!.id);

  const locationId = req.body?.locationId;
  if (!await verifyOptionalLocationMembership(locationId, req.user!.id)) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
    return;
  }
  const { existingTags, customFieldDefs } = await fetchLocationAiMeta(locationId);

  const imageParts = allFiles.map((f) => ({
    type: 'image' as const,
    image: f.buffer,
    mimeType: f.mimetype,
  }));

  await pipeAiStreamToResponse(res, model, {
    system: buildAnalysisPrompt(existingTags, settings.custom_prompt, customFieldDefs),
    userContent: [...imageParts, { type: 'text' as const, text: buildAnalysisUserText(allFiles.length) }],
    ...streamOpts(settings, { maxTokens: allFiles.length > 1 ? 2000 : 1500 }),
  });
}));

// POST /api/ai/analyze/stream — stream analysis of stored photos
streamRouter.post('/analyze/stream', aiLimiter, aiRouteHandler('stream analyze photo', async (req, res) => {
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
  if (config.aiMock) { await sendMockJsonStream(res, buildMockAnalysisResult()); return; }

  const { settings, model } = await resolveUserModel(req.user!.id);

  const loaded = await loadPhotosForAnalysis(ids, req.user!.id);
  if (!loaded) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Photo not found or access denied' });
    return;
  }

  const imageParts = loaded.images.map((img) => ({
    type: 'image' as const,
    image: img.buffer,
    mimeType: img.mimeType,
  }));

  await pipeAiStreamToResponse(res, model, {
    system: buildAnalysisPrompt(loaded.existingTags, settings.custom_prompt, loaded.customFieldDefs),
    userContent: [...imageParts, { type: 'text' as const, text: buildAnalysisUserText(loaded.images.length) }],
    ...streamOpts(settings, { maxTokens: loaded.images.length > 1 ? 2000 : 1500 }),
  });
}));

// POST /api/ai/correct/stream — correct a previous analysis result
streamRouter.post('/correct/stream', aiLimiter, aiRouteHandler('stream correction', async (req, res) => {
  const { previousResult, correction, locationId } = req.body;

  // Validate previousResult shape
  if (
    !previousResult ||
    typeof previousResult !== 'object' ||
    typeof previousResult.name !== 'string' ||
    !Array.isArray(previousResult.items)
  ) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'previousResult must have name (string) and items (array)' });
    return;
  }

  const correctionText = validateTextInput(correction, 'correction', 1000);

  // Sanitize previousResult to prevent oversized prompts
  const safePrevious = {
    name: String(previousResult.name).slice(0, 255),
    items: (previousResult.items as unknown[])
      .filter((i): i is string => typeof i === 'string')
      .slice(0, 100)
      .map((i) => i.slice(0, 500)),
    tags: Array.isArray(previousResult.tags)
      ? (previousResult.tags as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 20)
      : [],
    notes: typeof previousResult.notes === 'string' ? previousResult.notes.slice(0, 2000) : '',
  };

  // Mock mode
  if (config.aiMock) {
    await sendMockJsonStream(res, {
      name: safePrevious.name,
      items: [...safePrevious.items.slice(0, -1), 'Corrected item'],
      tags: safePrevious.tags,
      notes: `Corrected: ${correctionText.slice(0, 50)}`,
    });
    return;
  }

  const { settings, model } = await resolveUserModel(req.user!.id);

  // Optional location membership check + tag fetch
  if (!await verifyOptionalLocationMembership(locationId, req.user!.id)) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
    return;
  }
  const { existingTags, customFieldDefs } = await fetchLocationAiMeta(locationId);

  const system = buildCorrectionPrompt(existingTags, customFieldDefs);

  const userMessage = `Previous analysis result:\n${JSON.stringify(safePrevious, null, 2)}\n\nUser correction: ${correctionText}`;

  await pipeAiStreamToResponse(res, model, {
    system,
    userContent: userMessage,
    ...streamOpts(settings, { maxTokens: 1500 }),
  });
}));

export { streamRouter };
