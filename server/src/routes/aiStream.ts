import { Router } from 'express';
import { createPinnedFetch, validateEndpointUrl } from '../lib/aiCaller.js';
import { buildCommandContext, buildInventoryContext, fetchExistingTags } from '../lib/aiContext.js';
import { buildMockAnalysisResult, loadPhotosForAnalysis } from '../lib/aiPhotoLoader.js';
import { buildSystemPrompt as buildAnalysisPrompt, buildAnalysisUserText, buildCorrectionPrompt, buildReanalysisPrompt, buildReanalysisUserContent, IMAGE_TOKENS_MULTI, IMAGE_TOKENS_SINGLE } from '../lib/aiProviders.js';
import { aiRouteHandler, validateTextInput } from '../lib/aiRouteHandler.js';
import { resolvePrompt, sanitizeForPrompt } from '../lib/aiSanitize.js';
import { QueryResultSchema } from '../lib/aiSchemas.js';
import type { TaskType, UserAiSettings } from '../lib/aiSettings.js';
import { getConfigForTask, getUserAiSettings } from '../lib/aiSettings.js';
import { initSseResponse, pipeAiStreamToResponse } from '../lib/aiStream.js';
import { verifyOptionalLocationMembership } from '../lib/binAccess.js';
import type { CommandRequest } from '../lib/commandParser.js';
import { buildSystemPrompt as buildCommandSysPrompt, buildUserMessage as buildCommandUserMsg, buildUnifiedSystemPrompt } from '../lib/commandParser.js';
import { config, isDemoUser } from '../lib/config.js';
import { fetchCustomFieldDefs } from '../lib/customFieldHelpers.js';
import { buildSystemPrompt as buildQuerySysPrompt, buildUserMessage as buildQueryUserMsg } from '../lib/inventoryQuery.js';
import { aiLimiter } from '../lib/rateLimiters.js';
import { createSdkModel } from '../lib/sdkProviderFactory.js';
import { buildPrompt as buildStructurePrompt, STRUCTURE_TEXT_TOKENS } from '../lib/structureText.js';
import { demoMemoryPhotoUpload, memoryPhotoUpload } from '../lib/uploadConfig.js';
import { authenticate } from '../middleware/auth.js';
import { demoConnectionLimiter, isDemoUser as isDemoConn } from '../middleware/demoConnectionLimiter.js';
import { requireLocationMember } from '../middleware/locationAccess.js';
import { checkAiCredits, requirePro } from '../middleware/requirePlan.js';

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
async function resolveUserModel(userId: string, task: TaskType, isDemoUser = false) {
  const settings = await getUserAiSettings(userId);
  const taskConfig = getConfigForTask(settings, task);
  const resolvedIps = taskConfig.endpointUrl
    ? await validateEndpointUrl(taskConfig.endpointUrl, isDemoUser)
    : undefined;
  const pinnedFetch = resolvedIps ? createPinnedFetch(resolvedIps) : undefined;
  const model = createSdkModel(taskConfig, pinnedFetch);
  return { settings, model };
}

/** Build common StreamOptions from user AI settings. */
function streamOpts(settings: UserAiSettings, overrides?: { maxTokens?: number; temperature?: number }) {
  return {
    maxTokens: overrides?.maxTokens ?? settings.max_tokens ?? 4096,
    temperature: overrides?.temperature ?? settings.temperature ?? 0.3,
    topP: settings.top_p ?? undefined,
    abortSignal: AbortSignal.timeout((settings.request_timeout ?? 300) * 1000),
  };
}

/** Validate and sanitize optional binIds from request body. */
function validateBinIds(binIds: unknown): string[] | undefined {
  if (!binIds) return undefined;
  if (!Array.isArray(binIds)) return undefined;
  const valid = binIds
    .filter((id): id is string => typeof id === 'string' && /^[a-zA-Z0-9]{1,10}$/.test(id))
    .slice(0, 100);
  return valid.length > 0 ? valid : undefined;
}

// POST /api/ai/query/stream
streamRouter.post('/query/stream', aiLimiter, requirePro(), checkAiCredits, requireLocationMember(), aiRouteHandler('stream query', async (req, res) => {
  const question = validateTextInput(req.body.question, 'question');
  const { locationId } = req.body;
  const [{ settings, model }, context] = await Promise.all([
    resolveUserModel(req.user!.id, 'query', isDemoUser(req)),
    buildInventoryContext(locationId, req.user!.id),
  ]);

  await pipeAiStreamToResponse(res, model, {
    schema: QueryResultSchema,
    system: buildQuerySysPrompt(settings.query_prompt ?? undefined, isDemoUser(req)),
    userContent: buildQueryUserMsg(question, context),
    ...streamOpts(settings, { maxTokens: 4096 }),
  });
}));

// POST /api/ai/command/stream
streamRouter.post('/command/stream', aiLimiter, requirePro(), checkAiCredits, requireLocationMember(), aiRouteHandler('stream command', async (req, res) => {
  const text = validateTextInput(req.body.text, 'text');
  const { locationId } = req.body;
  const [{ settings, model }, context] = await Promise.all([
    resolveUserModel(req.user!.id, 'command', isDemoUser(req)),
    buildCommandContext(locationId, req.user!.id),
  ]);
  const request: CommandRequest = { text, context };

  // No schema constraint — the prompt's examples and instructions produce
  // reliable JSON, and structured-output mode causes providers like Gemini
  // to aggressively omit optional fields (items, area_name in create_bin).
  await pipeAiStreamToResponse(res, model, {
    system: buildCommandSysPrompt(request, settings.command_prompt ?? undefined, isDemoUser(req)),
    userContent: buildCommandUserMsg(request),
    ...streamOpts(settings, { maxTokens: 2500, temperature: 0.2 }),
  });
}));

// POST /api/ai/ask/stream — unified command+query endpoint
streamRouter.post('/ask/stream', aiLimiter, requirePro(), checkAiCredits, requireLocationMember(), aiRouteHandler('stream ask', async (req, res) => {
  const text = validateTextInput(req.body.text, 'text');
  const { locationId, binIds: rawBinIds } = req.body;
  const binIds = validateBinIds(rawBinIds);

  const [{ settings, model }, context] = await Promise.all([
    resolveUserModel(req.user!.id, 'command', isDemoUser(req)),
    buildCommandContext(locationId, req.user!.id, binIds),
  ]);

  if (binIds?.length && context.bins.length === 0) {
    const { ValidationError } = await import('../lib/httpErrors.js');
    throw new ValidationError('No matching bins found for the provided IDs');
  }

  const isScoped = (binIds?.length ?? 0) > 0;
  const request: CommandRequest = { text, context };

  await pipeAiStreamToResponse(res, model, {
    system: buildUnifiedSystemPrompt(request, settings.command_prompt ?? undefined, settings.query_prompt ?? undefined, isDemoUser(req), isScoped),
    userContent: buildCommandUserMsg(request),
    ...streamOpts(settings, { maxTokens: 2500, temperature: 0.2 }),
  });
}));

// POST /api/ai/structure-text/stream
streamRouter.post('/structure-text/stream', aiLimiter, requirePro(), checkAiCredits, aiRouteHandler('stream structure-text', async (req, res) => {
  const text = validateTextInput(req.body.text, 'text');
  const { context } = req.body;
  const { settings, model } = await resolveUserModel(req.user!.id, 'structure', isDemoUser(req));

  await pipeAiStreamToResponse(res, model, {
    system: buildStructurePrompt({ text, mode: 'items', context }, settings.structure_prompt ?? undefined, isDemoUser(req)),
    userContent: text,
    ...streamOpts(settings, { maxTokens: STRUCTURE_TEXT_TOKENS, temperature: 0.2 }),
  });
}));

// Dynamic multer selector: demo users get 3 MB/file limit, others get the standard limit.
const analyzeImageFields = [
  { name: 'photo', maxCount: 1 },
  { name: 'photos', maxCount: 5 },
];
const DEMO_REQUEST_MAX_BYTES = 15 * 1024 * 1024;

function demoAwareAnalyzeUpload(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction): void {
  const upload = isDemoConn(req) ? demoMemoryPhotoUpload : memoryPhotoUpload;
  upload.fields(analyzeImageFields)(req, res, (err) => {
    if (err) { next(err); return; }
    if (isDemoConn(req)) {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const total = [...(files?.photo || []), ...(files?.photos || [])].reduce((sum, f) => sum + f.size, 0);
      if (total > DEMO_REQUEST_MAX_BYTES) {
        res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Total upload size exceeds 15 MB' });
        return;
      }
    }
    next();
  });
}

// POST /api/ai/analyze-image/stream
streamRouter.post('/analyze-image/stream', demoConnectionLimiter, demoAwareAnalyzeUpload, aiLimiter, requirePro(), checkAiCredits, aiRouteHandler('stream analyze image', async (req, res) => {
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

  const { settings, model } = await resolveUserModel(req.user!.id, 'analysis', isDemoUser(req));

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
    system: buildAnalysisPrompt(existingTags, settings.custom_prompt, customFieldDefs, isDemoUser(req)),
    userContent: [...imageParts, { type: 'text' as const, text: buildAnalysisUserText(allFiles.length) }],
    ...streamOpts(settings, { maxTokens: allFiles.length > 1 ? IMAGE_TOKENS_MULTI : IMAGE_TOKENS_SINGLE }),
  });
}));

// POST /api/ai/analyze/stream — stream analysis of stored photos
streamRouter.post('/analyze/stream', aiLimiter, requirePro(), checkAiCredits, aiRouteHandler('stream analyze photo', async (req, res) => {
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

  const { settings, model } = await resolveUserModel(req.user!.id, 'analysis', isDemoUser(req));

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
    system: buildAnalysisPrompt(loaded.existingTags, settings.custom_prompt, loaded.customFieldDefs, isDemoUser(req)),
    userContent: [...imageParts, { type: 'text' as const, text: buildAnalysisUserText(loaded.images.length) }],
    ...streamOpts(settings, { maxTokens: loaded.images.length > 1 ? IMAGE_TOKENS_MULTI : IMAGE_TOKENS_SINGLE }),
  });
}));

// POST /api/ai/correct/stream — correct a previous analysis result
streamRouter.post('/correct/stream', aiLimiter, requirePro(), checkAiCredits, aiRouteHandler('stream correction', async (req, res) => {
  const { previousResult: rawPrev, correction, locationId } = req.body;

  const validatedPrev = validatePreviousResult(rawPrev);
  if (!validatedPrev) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'previousResult must have name (string) and items (array)' });
    return;
  }

  const correctionText = validateTextInput(correction, 'correction', 1000);

  const safePrevious = sanitizePreviousResult(validatedPrev);

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

  const { settings, model } = await resolveUserModel(req.user!.id, 'analysis', isDemoUser(req));

  // Optional location membership check + tag fetch
  if (!await verifyOptionalLocationMembership(locationId, req.user!.id)) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
    return;
  }
  const { existingTags, customFieldDefs } = await fetchLocationAiMeta(locationId);

  const system = buildCorrectionPrompt(existingTags, customFieldDefs);

  const sanitizedCorrection = sanitizeForPrompt(correctionText);
  const userMessage = `<user_data type="previous_result" trust="none">\n${JSON.stringify(safePrevious, null, 2)}\n</user_data>\n\n<user_data type="correction" trust="none">\n${sanitizedCorrection}\n</user_data>`;

  await pipeAiStreamToResponse(res, model, {
    system,
    userContent: userMessage,
    ...streamOpts(settings, { maxTokens: 2500 }),
  });
}));

/** Validate that previousResult has the expected shape. Returns the validated object or null. */
function validatePreviousResult(value: unknown): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as Record<string, unknown>).name !== 'string' ||
    !Array.isArray((value as Record<string, unknown>).items)
  ) {
    return null;
  }
  return value as Record<string, unknown>;
}

/** Sanitize a previousResult object to prevent oversized prompts. */
function sanitizePreviousResult(previousResult: Record<string, unknown>) {
  return {
    name: String(previousResult.name ?? '').slice(0, 255),
    items: Array.isArray(previousResult.items)
      ? (previousResult.items as unknown[]).slice(0, 100).map((i) => {
          if (typeof i === 'string') return { name: i.slice(0, 500) };
          if (i && typeof i === 'object') {
            const obj = i as Record<string, unknown>;
            return {
              name: String(obj.name ?? '').slice(0, 500),
              ...(typeof obj.quantity === 'number' ? { quantity: obj.quantity } : {}),
            };
          }
          return { name: String(i).slice(0, 500) };
        })
      : [],
    tags: Array.isArray(previousResult.tags)
      ? (previousResult.tags as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 20)
      : [],
    notes: typeof previousResult.notes === 'string' ? previousResult.notes.slice(0, 2000) : '',
    ...(previousResult.customFields && typeof previousResult.customFields === 'object'
      ? { customFields: previousResult.customFields }
      : {}),
  };
}

// POST /api/ai/reanalyze/stream — reanalyze stored photos with previous result context
streamRouter.post('/reanalyze/stream', aiLimiter, requirePro(), checkAiCredits, aiRouteHandler('stream reanalyze photo', async (req, res) => {
  const { photoIds, previousResult: rawPrev } = req.body;

  const previousResult = validatePreviousResult(rawPrev);
  if (!previousResult) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'previousResult must have name (string) and items (array)' });
    return;
  }

  let ids: string[] = [];
  if (Array.isArray(photoIds) && photoIds.length > 0) {
    ids = photoIds.filter((id: unknown): id is string => typeof id === 'string').slice(0, 5);
  }

  if (ids.length === 0) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'photoIds is required' });
    return;
  }

  if (config.aiMock) { await sendMockJsonStream(res, buildMockAnalysisResult()); return; }

  const { settings, model } = await resolveUserModel(req.user!.id, 'analysis', isDemoUser(req));

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

  const safePrevious = sanitizePreviousResult(previousResult);

  await pipeAiStreamToResponse(res, model, {
    system: buildReanalysisPrompt(loaded.existingTags, loaded.customFieldDefs),
    userContent: buildReanalysisUserContent(safePrevious, imageParts),
    ...streamOpts(settings, { maxTokens: loaded.images.length > 1 ? IMAGE_TOKENS_MULTI : IMAGE_TOKENS_SINGLE }),
  });
}));

// POST /api/ai/reanalyze-image/stream — reanalyze uploaded photos with previous result context
streamRouter.post('/reanalyze-image/stream', memoryPhotoUpload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'photos', maxCount: 5 },
]), aiLimiter, requirePro(), aiRouteHandler('stream reanalyze image', async (req, res) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const allFiles = [
    ...(files?.photo || []),
    ...(files?.photos || []),
  ].slice(0, 5);

  if (allFiles.length === 0) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'photo file is required (JPEG, PNG, WebP, or GIF, max 5MB)' });
    return;
  }

  let rawPrev: unknown = null;
  try {
    rawPrev = typeof req.body?.previousResult === 'string'
      ? JSON.parse(req.body.previousResult)
      : req.body?.previousResult;
  } catch {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'previousResult must be valid JSON' });
    return;
  }

  const previousResult = validatePreviousResult(rawPrev);
  if (!previousResult) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'previousResult must have name (string) and items (array)' });
    return;
  }

  if (config.aiMock) { await sendMockJsonStream(res, buildMockAnalysisResult()); return; }

  const { settings, model } = await resolveUserModel(req.user!.id, 'analysis', isDemoUser(req));

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

  const safePrevious = sanitizePreviousResult(previousResult);

  await pipeAiStreamToResponse(res, model, {
    system: buildReanalysisPrompt(existingTags, customFieldDefs),
    userContent: buildReanalysisUserContent(safePrevious, imageParts),
    ...streamOpts(settings, { maxTokens: allFiles.length > 1 ? IMAGE_TOKENS_MULTI : IMAGE_TOKENS_SINGLE }),
  });
}));

// POST /api/ai/reorganize/stream
streamRouter.post('/reorganize/stream', aiLimiter, requirePro(), checkAiCredits, requireLocationMember(), aiRouteHandler('stream reorganization', async (req, res) => {
  const { locationId: _locationId, bins: inputBins, maxBins, areaName,
    userNotes, strictness, granularity, ambiguousPolicy, duplicates, outliers,
    minItemsPerBin, maxItemsPerBin } = req.body;

  if (!Array.isArray(inputBins) || inputBins.length === 0) {
    throw new (await import('../lib/httpErrors.js')).ValidationError('bins array is required');
  }
  if (maxBins != null && (typeof maxBins !== 'number' || maxBins < 1)) {
    throw new (await import('../lib/httpErrors.js')).ValidationError('maxBins must be a positive number');
  }

  const { settings, model } = await resolveUserModel(req.user!.id, 'reorganization', isDemoUser(req));

  // Build system prompt
  const { DEFAULT_REORGANIZATION_PROMPT } = await import('../lib/defaultPrompts.js');
  const basePrompt = resolvePrompt(DEFAULT_REORGANIZATION_PROMPT, settings.reorganization_prompt, isDemoUser(req));
  const maxBinsInstruction = maxBins ? `Create at most ${maxBins} bins.` : 'Choose the optimal number of bins.';
  const areaInstruction = areaName ? `These bins are in the "${sanitizeForPrompt(areaName)}" area.` : '';

  const strictnessInstruction = strictness === 'conservative'
    ? 'Be conservative: prefer fewer moves from original bins. Only regroup when the benefit is clear.'
    : strictness === 'aggressive'
      ? 'Be aggressive: maximize consolidation and create tightly themed bins, even if it means moving most items.'
      : 'Use moderate grouping: balance specificity and consolidation.';

  const granularityInstruction = granularity === 'broad'
    ? 'Use broad category names (e.g., "Hardware", "Electronics") rather than specific ones.'
    : granularity === 'specific'
      ? 'Use highly specific, narrow bin names that describe exact item types (e.g., "M3 Hex Bolts", "USB-C Cables").'
      : 'Use medium granularity for bin names.';

  // Resolve potentially contradictory combinations:
  // - multi-bin policy implies duplicates are allowed
  // - misc-bin policy implies a catch-all bin exists (don't also say "no outlier bin")
  const effectiveDuplicates = ambiguousPolicy === 'multi-bin' ? 'allow' : (duplicates ?? 'force-single');

  const duplicatesInstruction = effectiveDuplicates === 'allow'
    ? 'Items may appear in more than one output bin when they fit multiple categories.'
    : 'Every item from the input MUST appear in exactly one output bin. Do not drop or duplicate items.';

  const ambiguousInstruction = ambiguousPolicy === 'multi-bin'
    ? 'If an item could belong to multiple bins, place it in all applicable bins.'
    : ambiguousPolicy === 'misc-bin'
      ? 'If an item does not clearly fit any group, place it in a dedicated "Miscellaneous" bin rather than forcing it.'
      : 'If an item could belong to multiple bins, assign it to the single best-fitting bin.';

  // When misc-bin is active, a catch-all already exists — don't contradict it
  const effectiveOutliers = ambiguousPolicy === 'misc-bin' ? 'dedicated' : (outliers ?? 'force-closest');

  const outliersInstruction = effectiveOutliers === 'dedicated'
    ? 'Collect items that do not fit any natural group into a dedicated "Miscellaneous" bin.'
    : 'Force every item into the closest matching group; do not create an outlier or miscellaneous bin.';

  const itemsPerBinParts: string[] = [];
  if (typeof minItemsPerBin === 'number' && minItemsPerBin >= 1) itemsPerBinParts.push(`at least ${minItemsPerBin}`);
  if (typeof maxItemsPerBin === 'number' && maxItemsPerBin >= 1) itemsPerBinParts.push(`at most ${maxItemsPerBin}`);
  const itemsPerBinInstruction = itemsPerBinParts.length > 0
    ? `Each bin should contain ${itemsPerBinParts.join(' and ')} items.`
    : '';

  const notesInstruction = userNotes?.trim() ? `Additional user guidance: ${sanitizeForPrompt(userNotes.trim())}` : '';

  // Extract unique tags from input bins for reuse guidance
  const existingTags = [...new Set(
    inputBins.flatMap((b: { tags?: string[] }) => b.tags ?? [])
  )].sort();

  const tagBlock = existingTags.length > 0
    ? `EXISTING TAGS from these bins: [${existingTags.join(', ')}]\nYou MUST reuse these tags whenever they are even loosely relevant. Only create a new tag when no existing tag covers the category.`
    : '';

  const system = basePrompt
    .replace('{max_bins_instruction}', maxBinsInstruction)
    .replace('{area_instruction}', areaInstruction)
    .replace('{strictness_instruction}', strictnessInstruction)
    .replace('{granularity_instruction}', granularityInstruction)
    .replace('{duplicates_instruction}', duplicatesInstruction)
    .replace('{ambiguous_instruction}', ambiguousInstruction)
    .replace('{outliers_instruction}', outliersInstruction)
    .replace('{items_per_bin_instruction}', itemsPerBinInstruction)
    .replace('{notes_instruction}', notesInstruction)
    .replace('{available_tags}', tagBlock);

  // Build user message: list of bins with items (sanitized)
  const binDescriptions = inputBins.map((b: { name: string; items: string[] }) =>
    `- ${sanitizeForPrompt(b.name)}: ${b.items.length > 0 ? b.items.map((i: string) => sanitizeForPrompt(i)).join(', ') : '(empty)'}`
  ).join('\n');
  const userContent = `Here are the bins to reorganize:\n\n${binDescriptions}`;

  if (config.aiMock) {
    await sendMockJsonStream(res, {
      bins: [{ name: 'Reorganized Bin', items: inputBins.flatMap((b: { items: string[] }) => b.items) }],
      summary: 'Mock reorganization result.',
    });
    return;
  }

  await pipeAiStreamToResponse(res, model, {
    system,
    userContent,
    ...streamOpts(settings, { temperature: 0.3, maxTokens: 16000 }),
  });
}));

export { streamRouter };
