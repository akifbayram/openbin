import { Router } from 'express';
import { createPinnedFetch, validateEndpointUrl } from '../lib/aiCaller.js';
import { buildCommandContext, buildInventoryContext } from '../lib/aiContext.js';
import { buildMockAnalysisResult, loadPhotosForAnalysis } from '../lib/aiPhotoLoader.js';
import { buildSystemPrompt as buildAnalysisPrompt, buildAnalysisUserText, buildContextPreamble, buildCorrectionPrompt, buildReanalysisPrompt, buildReanalysisUserContent, buildTagBlock, IMAGE_TOKENS_MULTI, IMAGE_TOKENS_SINGLE } from '../lib/aiProviders.js';
import { extractPhotoIds, extractUploadedFiles, sanitizePreviousResult, validatePreviousResult, verifyLocationAndFetchMeta } from '../lib/aiRequestHelpers.js';
import { aiRouteHandler, validateTextInput } from '../lib/aiRouteHandler.js';
import { resolvePrompt, sanitizeForPrompt } from '../lib/aiSanitize.js';
import { QueryResultSchema } from '../lib/aiSchemas.js';
import type { TaskType, UserAiSettings } from '../lib/aiSettings.js';
import { getConfigForTask, getUserAiSettings } from '../lib/aiSettings.js';
import { initSseResponse, pipeAiStreamToResponse, streamAiToWriter } from '../lib/aiStream.js';
import type { CommandRequest } from '../lib/commandParser.js';
import { buildSystemPrompt as buildCommandSysPrompt, buildUserMessage as buildCommandUserMsg, buildUnifiedSystemPrompt } from '../lib/commandParser.js';
import { config, isDemoUser } from '../lib/config.js';
import { parseHistoryFromBody } from '../lib/conversationHistory.js';
import { ValidationError } from '../lib/httpErrors.js';
import { classifyIntent } from '../lib/intentClassifier.js';
import { buildSystemPrompt as buildQuerySysPrompt, buildUserMessage as buildQueryUserMsg } from '../lib/inventoryQuery.js';
import { refundAiCredit } from '../lib/planGate.js';
import { aiRateLimiters } from '../lib/rateLimiters.js';
import { createSdkModel } from '../lib/sdkProviderFactory.js';
import { buildPrompt as buildStructurePrompt, STRUCTURE_TEXT_TOKENS } from '../lib/structureText.js';
import { resolveTaskConfig, TASK_GROUP_MAP } from '../lib/taskRouting.js';
import { demoMemoryPhotoUpload, memoryPhotoUpload } from '../lib/uploadConfig.js';
import { authenticate } from '../middleware/auth.js';
import { demoConnectionLimiter, isDemoUser as isDemoConn } from '../middleware/demoConnectionLimiter.js';
import { requireLocationMember } from '../middleware/locationAccess.js';
import { checkAiCredits, requireAiAccess, requirePlusOrAbove } from '../middleware/requirePlan.js';

const streamRouter = Router();
streamRouter.use(authenticate);

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

async function resolveUserModel(userId: string, task: TaskType, isDemoUser = false) {
  const settings = await getUserAiSettings(userId);
  const group = TASK_GROUP_MAP[task];
  const taskConfig = group
    ? await resolveTaskConfig(userId, group, settings.config)
    : getConfigForTask(settings, task);
  const resolvedIps = taskConfig.endpointUrl
    ? await validateEndpointUrl(taskConfig.endpointUrl, isDemoUser)
    : undefined;
  const pinnedFetch = resolvedIps ? createPinnedFetch(resolvedIps) : undefined;
  const model = createSdkModel(taskConfig, pinnedFetch);
  return { settings, model };
}

function streamOpts(settings: UserAiSettings, overrides?: { maxTokens?: number; temperature?: number }) {
  return {
    maxTokens: overrides?.maxTokens ?? settings.max_tokens ?? 4096,
    temperature: overrides?.temperature ?? settings.temperature ?? 0.3,
    topP: settings.top_p ?? undefined,
    abortSignal: AbortSignal.timeout((settings.request_timeout ?? 300) * 1000),
  };
}

function assertBinsFound(binIds: string[] | undefined, bins: { length: number }): void {
  if (binIds?.length && bins.length === 0) {
    throw new ValidationError('No matching bins found for the provided IDs');
  }
}

function validateBinIds(binIds: unknown): string[] | undefined {
  if (!binIds) return undefined;
  if (!Array.isArray(binIds)) return undefined;
  const valid = binIds
    .filter((id): id is string => typeof id === 'string' && /^[a-zA-Z0-9-]{1,36}$/.test(id))
    .slice(0, 100);
  return valid.length > 0 ? valid : undefined;
}

// POST /api/ai/query/stream
streamRouter.post('/query/stream', ...aiRateLimiters, requireAiAccess(), checkAiCredits, requireLocationMember(), aiRouteHandler('stream query', async (req, res) => {
  const question = validateTextInput(req.body.question, 'question');
  const { locationId } = req.body;
  const priorMessages = parseHistoryFromBody(req.body);
  const [{ settings, model }, context] = await Promise.all([
    resolveUserModel(req.user!.id, 'query', isDemoUser(req)),
    buildInventoryContext(locationId, req.user!.id, undefined, question),
  ]);

  await pipeAiStreamToResponse(res, model, {
    schema: QueryResultSchema,
    system: buildQuerySysPrompt(settings.query_prompt ?? undefined, isDemoUser(req)),
    userContent: buildQueryUserMsg(question, context),
    priorMessages,
    ...streamOpts(settings, { maxTokens: 4096 }),
  });
}));

// POST /api/ai/command/stream
streamRouter.post('/command/stream', ...aiRateLimiters, requireAiAccess(), checkAiCredits, requireLocationMember(), aiRouteHandler('stream command', async (req, res) => {
  const text = validateTextInput(req.body.text, 'text');
  const { locationId } = req.body;
  const priorMessages = parseHistoryFromBody(req.body);
  const [{ settings, model }, context] = await Promise.all([
    resolveUserModel(req.user!.id, 'command', isDemoUser(req)),
    buildCommandContext(locationId, req.user!.id, undefined, text),
  ]);
  const request: CommandRequest = { text, context };

  // No schema constraint — the prompt's examples and instructions produce
  // reliable JSON, and structured-output mode causes providers like Gemini
  // to aggressively omit optional fields (items, area_name in create_bin).
  await pipeAiStreamToResponse(res, model, {
    system: buildCommandSysPrompt(context.availableColors, context.availableIcons, settings.command_prompt ?? undefined, isDemoUser(req)),
    userContent: buildCommandUserMsg(request),
    priorMessages,
    ...streamOpts(settings, { maxTokens: 2500, temperature: 0.2 }),
  });
}));

// POST /api/ai/ask/stream — unified command+query endpoint
streamRouter.post('/ask/stream', ...aiRateLimiters, requireAiAccess(), checkAiCredits, requireLocationMember(), aiRouteHandler('stream ask', async (req, res) => {
  const text = validateTextInput(req.body.text, 'text');
  const { locationId, binIds: rawBinIds } = req.body;
  const binIds = validateBinIds(rawBinIds);
  const isScoped = (binIds?.length ?? 0) > 0;
  const priorMessages = parseHistoryFromBody(req.body);

  const scopeNote = isScoped
    ? '\nSELECTION SCOPE: The user selected specific bins. The inventory context below contains ONLY these bins. Apply actions or answer based only on the bins provided.\n'
    : '';
  const intent = classifyIntent(text);

  if (intent === 'query') {
    const [{ settings, model }, queryContext] = await Promise.all([
      resolveUserModel(req.user!.id, 'query', isDemoUser(req)),
      buildInventoryContext(locationId, req.user!.id, binIds, text),
    ]);
    assertBinsFound(binIds, queryContext.bins);

    await pipeAiStreamToResponse(res, model, {
      schema: QueryResultSchema,
      system: buildQuerySysPrompt(settings.query_prompt ?? undefined, isDemoUser(req)),
      userContent: buildQueryUserMsg(`${scopeNote}${text}`, queryContext),
      priorMessages,
      ...streamOpts(settings, { maxTokens: 4096 }),
    });
  } else {
    const [{ settings, model }, context] = await Promise.all([
      resolveUserModel(req.user!.id, 'command', isDemoUser(req)),
      buildCommandContext(locationId, req.user!.id, binIds, text),
    ]);
    assertBinsFound(binIds, context.bins);

    const system = intent === 'command'
      ? buildCommandSysPrompt(context.availableColors, context.availableIcons, settings.command_prompt ?? undefined, isDemoUser(req))
      : buildUnifiedSystemPrompt(context.availableColors, context.availableIcons, settings.command_prompt ?? undefined, settings.query_prompt ?? undefined, isDemoUser(req), isScoped);
    const request: CommandRequest = { text: intent === 'command' ? `${scopeNote}${text}` : text, context };
    await pipeAiStreamToResponse(res, model, {
      system,
      userContent: buildCommandUserMsg(request),
      priorMessages,
      ...streamOpts(settings, { maxTokens: 2500, temperature: 0.2 }),
    });
  }
}));

// POST /api/ai/structure-text/stream
streamRouter.post('/structure-text/stream', ...aiRateLimiters, requireAiAccess(), checkAiCredits, aiRouteHandler('stream structure-text', async (req, res) => {
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
streamRouter.post('/analyze-image/stream', demoConnectionLimiter, demoAwareAnalyzeUpload, ...aiRateLimiters, requirePlusOrAbove(), requireAiAccess(), checkAiCredits, aiRouteHandler('stream analyze image', async (req, res) => {
  const allFiles = extractUploadedFiles(req);

  if (config.aiMock) { await sendMockJsonStream(res, buildMockAnalysisResult()); return; }

  const { settings, model } = await resolveUserModel(req.user!.id, 'analysis', isDemoUser(req));
  const { existingTags, customFieldDefs } = await verifyLocationAndFetchMeta(req.body?.locationId, req.user!.id);

  const imageParts = allFiles.map((f) => ({
    type: 'image' as const,
    image: f.buffer,
    mimeType: f.mimetype,
  }));

  const preamble = buildContextPreamble(existingTags, customFieldDefs);
  await pipeAiStreamToResponse(res, model, {
    system: buildAnalysisPrompt(settings.custom_prompt, isDemoUser(req)),
    userContent: [...imageParts, { type: 'text' as const, text: preamble + buildAnalysisUserText(allFiles.length) }],
    ...streamOpts(settings, { maxTokens: allFiles.length > 1 ? IMAGE_TOKENS_MULTI : IMAGE_TOKENS_SINGLE }),
  });
}));

// POST /api/ai/analyze/stream — stream analysis of stored photos
streamRouter.post('/analyze/stream', ...aiRateLimiters, requirePlusOrAbove(), requireAiAccess(), checkAiCredits, aiRouteHandler('stream analyze photo', async (req, res) => {
  const ids = extractPhotoIds(req.body);

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

  const preambleStored = buildContextPreamble(loaded.existingTags, loaded.customFieldDefs);
  await pipeAiStreamToResponse(res, model, {
    system: buildAnalysisPrompt(settings.custom_prompt, isDemoUser(req)),
    userContent: [...imageParts, { type: 'text' as const, text: preambleStored + buildAnalysisUserText(loaded.images.length) }],
    ...streamOpts(settings, { maxTokens: loaded.images.length > 1 ? IMAGE_TOKENS_MULTI : IMAGE_TOKENS_SINGLE }),
  });
}));

// POST /api/ai/correct/stream — correct a previous analysis result
streamRouter.post('/correct/stream', ...aiRateLimiters, requireAiAccess(), checkAiCredits, aiRouteHandler('stream correction', async (req, res) => {
  const { correction, locationId } = req.body;

  const safePrevious = sanitizePreviousResult(validatePreviousResult(req.body.previousResult));
  const correctionText = validateTextInput(correction, 'correction', 1000);

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
  const { existingTags, customFieldDefs } = await verifyLocationAndFetchMeta(locationId, req.user!.id);

  const correctionPreamble = buildContextPreamble(existingTags, customFieldDefs);
  const sanitizedCorrection = sanitizeForPrompt(correctionText);
  const userMessage = `${correctionPreamble}<user_data type="previous_result" trust="none">\n${JSON.stringify(safePrevious, null, 2)}\n</user_data>\n\n<user_data type="correction" trust="none">\n${sanitizedCorrection}\n</user_data>`;

  await pipeAiStreamToResponse(res, model, {
    system: buildCorrectionPrompt(),
    userContent: userMessage,
    ...streamOpts(settings, { maxTokens: 2500 }),
  });
}));

// POST /api/ai/reanalyze-image/stream — reanalyze uploaded photos with previous result context
streamRouter.post('/reanalyze-image/stream', memoryPhotoUpload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'photos', maxCount: 5 },
]), ...aiRateLimiters, requirePlusOrAbove(), requireAiAccess(), checkAiCredits, aiRouteHandler('stream reanalyze image', async (req, res) => {
  const allFiles = extractUploadedFiles(req);

  let rawPrev: unknown = null;
  try {
    rawPrev = typeof req.body?.previousResult === 'string'
      ? JSON.parse(req.body.previousResult)
      : req.body?.previousResult;
  } catch {
    throw new ValidationError('previousResult must be valid JSON');
  }

  const safePrevious = sanitizePreviousResult(validatePreviousResult(rawPrev));

  if (config.aiMock) { await sendMockJsonStream(res, buildMockAnalysisResult()); return; }

  const { settings, model } = await resolveUserModel(req.user!.id, 'analysis', isDemoUser(req));
  const { existingTags, customFieldDefs } = await verifyLocationAndFetchMeta(req.body?.locationId, req.user!.id);

  const imageParts = allFiles.map((f) => ({
    type: 'image' as const,
    image: f.buffer,
    mimeType: f.mimetype,
  }));

  const reanalyzeImagePreamble = buildContextPreamble(existingTags, customFieldDefs);
  await pipeAiStreamToResponse(res, model, {
    system: buildReanalysisPrompt(),
    userContent: buildReanalysisUserContent(safePrevious, imageParts, reanalyzeImagePreamble),
    ...streamOpts(settings, { maxTokens: allFiles.length > 1 ? IMAGE_TOKENS_MULTI : IMAGE_TOKENS_SINGLE }),
  });
}));

// POST /api/ai/reorganize/stream
streamRouter.post('/reorganize/stream', ...aiRateLimiters, requirePlusOrAbove(), requireAiAccess(), checkAiCredits, requireLocationMember(), aiRouteHandler('stream reorganization', async (req, res) => {
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

  const existingTags = [...new Set(
    inputBins.flatMap((b: { tags?: string[] }) => b.tags ?? [])
  )].sort();
  const reorgTagBlock = buildTagBlock(existingTags);
  const reorgTagSection = reorgTagBlock ? `${reorgTagBlock}\n\n` : '';

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
    .replace('{available_tags}', '');

  // Build user message: list of bins with items (sanitized), tag context prepended
  const binDescriptions = inputBins.map((b: { name: string; items: string[] }) =>
    `- ${sanitizeForPrompt(b.name)}: ${b.items.length > 0 ? b.items.map((i: string) => sanitizeForPrompt(i)).join(', ') : '(empty)'}`
  ).join('\n');
  const totalInputItems = inputBins.reduce((sum: number, b: { items: string[] }) => sum + b.items.length, 0);
  const userContent = `${reorgTagSection}Here are the bins to reorganize (${totalInputItems} items total):\n\n${binDescriptions}\n\nIMPORTANT: The input contains exactly ${totalInputItems} items. Your output MUST contain exactly ${totalInputItems} items total across all bins.`;

  if (config.aiMock) {
    await sendMockJsonStream(res, {
      bins: [{ name: 'Reorganized Bin', items: inputBins.flatMap((b: { items: string[] }) => b.items) }],
      summary: 'Mock reorganization result.',
    });
    return;
  }

  // Retry up to 3 times if the AI drops or duplicates items
  const MAX_ATTEMPTS = 3;
  const writeEvent = initSseResponse(res);
  const sOpts = streamOpts(settings, { temperature: 0.3, maxTokens: 16000 });
  let finalText: string | null = null;
  let mismatch = false;

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) writeEvent({ type: 'retry', attempt });

      finalText = await streamAiToWriter(writeEvent, model, {
        system,
        userContent,
        ...sOpts,
      });

      if (!finalText) break; // error or truncation — stop retrying

      try {
        const parsed = JSON.parse(finalText);
        const outputItems = Array.isArray(parsed.bins)
          ? parsed.bins.reduce((sum: number, b: { items?: string[] }) => sum + (b.items?.length ?? 0), 0)
          : 0;
        mismatch = outputItems !== totalInputItems;
      } catch {
        finalText = null;
        break;
      }

      if (!mismatch) break; // counts match — done
    }

    if (finalText) writeEvent({ type: 'done', text: finalText });
    if (mismatch) await refundAiCredit(req.user!.id);
  } finally {
    res.end();
  }
}));

export { streamRouter };
