import { Router } from 'express';
import { buildCommandContext, buildInventoryContext } from '../lib/aiContext.js';
import { buildMockAnalysisResult, loadPhotosForAnalysis } from '../lib/aiPhotoLoader.js';
import { buildContextPreamble, buildCorrectionPrompt, buildReanalysisPrompt, buildReanalysisUserContent } from '../lib/aiProviders.js';
import { extractPhotoIds, extractUploadedFiles, sanitizePreviousResult, validatePreviousResult, verifyLocationAndFetchMeta } from '../lib/aiRequestHelpers.js';
import { aiRouteHandler, validateTextInput } from '../lib/aiRouteHandler.js';
import { sanitizeForPrompt } from '../lib/aiSanitize.js';
import { QueryResultSchema } from '../lib/aiSchemas.js';
import { initSseResponse, pipeAiStreamToResponse, streamAiToWriter } from '../lib/aiStream.js';
import { defaultAnalysisSystem, defaultAnalysisUserContent, resolveUserModel, runAnalysisStream, streamOpts } from '../lib/aiStreamHandler.js';
import type { CommandRequest } from '../lib/commandParser.js';
import { buildSystemPrompt as buildCommandSysPrompt, buildUserMessage as buildCommandUserMsg, buildUnifiedSystemPrompt } from '../lib/commandParser.js';
import { config, isDemoUser } from '../lib/config.js';
import { parseHistoryFromBody } from '../lib/conversationHistory.js';
import { ValidationError } from '../lib/httpErrors.js';
import { classifyIntent } from '../lib/intentClassifier.js';
import { buildSystemPrompt as buildQuerySysPrompt, buildUserMessage as buildQueryUserMsg, enrichQueryMatches } from '../lib/inventoryQuery.js';
import { refundAiCredit } from '../lib/planGate.js';
import { aiRateLimiters } from '../lib/rateLimiters.js';
import { buildReorganizePrompt } from '../lib/reorganizePrompt.js';
import { buildPrompt as buildStructurePrompt, STRUCTURE_TEXT_TOKENS } from '../lib/structureText.js';
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
    ...streamOpts(settings, { maxTokens: 4096, temperature: 0.2 }),
    enrichResult: async (parsed: unknown) => {
      const r = parsed as { answer?: string; matches?: unknown[] };
      const matches = Array.isArray(r.matches) ? r.matches : [];
      const enriched = await enrichQueryMatches(matches as never, locationId, req.user!.id);
      return { answer: r.answer ?? '', matches: enriched };
    },
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
      ...streamOpts(settings, { maxTokens: 4096, temperature: 0.2 }),
      enrichResult: async (parsed: unknown) => {
        const r = parsed as { answer?: string; matches?: unknown[] };
        const matches = Array.isArray(r.matches) ? r.matches : [];
        const enriched = await enrichQueryMatches(matches as never, locationId, req.user!.id);
        return { answer: r.answer ?? '', matches: enriched };
      },
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

  await runAnalysisStream({
    req,
    res,
    images: allFiles.map((f) => ({ buffer: f.buffer, mimeType: f.mimetype })),
    locationId: req.body?.locationId,
    buildSystem: defaultAnalysisSystem(isDemoUser(req)),
    buildUserContent: defaultAnalysisUserContent,
  });
}));

// POST /api/ai/analyze/stream — stream analysis of stored photos
streamRouter.post('/analyze/stream', ...aiRateLimiters, requirePlusOrAbove(), requireAiAccess(), checkAiCredits, aiRouteHandler('stream analyze photo', async (req, res) => {
  const ids = extractPhotoIds(req.body);
  if (config.aiMock) { await sendMockJsonStream(res, buildMockAnalysisResult()); return; }

  const loaded = await loadPhotosForAnalysis(ids, req.user!.id);
  if (!loaded) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Photo not found or access denied' });
    return;
  }

  await runAnalysisStream({
    req,
    res,
    images: loaded.images.map((img) => ({ buffer: img.buffer, mimeType: img.mimeType })),
    // loadPhotosForAnalysis already resolved the location + meta — skip re-fetching.
    meta: { existingTags: loaded.existingTags, customFieldDefs: loaded.customFieldDefs },
    buildSystem: defaultAnalysisSystem(isDemoUser(req)),
    buildUserContent: defaultAnalysisUserContent,
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
  const userMessage = `${correctionPreamble}<previous_result>\n${JSON.stringify(safePrevious, null, 2)}\n</previous_result>\n\n<correction_feedback>\n${sanitizedCorrection}\n</correction_feedback>`;

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

  await runAnalysisStream({
    req,
    res,
    images: allFiles.map((f) => ({ buffer: f.buffer, mimeType: f.mimetype })),
    locationId: req.body?.locationId,
    buildSystem: () => buildReanalysisPrompt(),
    buildUserContent: ({ imageParts, preamble }) => buildReanalysisUserContent(safePrevious, imageParts, preamble),
  });
}));

// POST /api/ai/reorganize/stream
streamRouter.post('/reorganize/stream', ...aiRateLimiters, requirePlusOrAbove(), requireAiAccess(), checkAiCredits, requireLocationMember(), aiRouteHandler('stream reorganization', async (req, res) => {
  const { bins: inputBins, maxBins, areaName, userNotes, strictness, granularity,
    ambiguousPolicy, duplicates, outliers, minItemsPerBin, maxItemsPerBin } = req.body;

  if (!Array.isArray(inputBins) || inputBins.length === 0) {
    throw new ValidationError('bins array is required');
  }
  if (maxBins != null && (typeof maxBins !== 'number' || maxBins < 1)) {
    throw new ValidationError('maxBins must be a positive number');
  }

  const { settings, model } = await resolveUserModel(req.user!.id, 'reorganization', isDemoUser(req));
  const { system, userContent, totalInputItems } = buildReorganizePrompt({
    inputBins, maxBins, areaName, userNotes, strictness, granularity, ambiguousPolicy,
    duplicates, outliers, minItemsPerBin, maxItemsPerBin,
    reorganizationPromptOverride: settings.reorganization_prompt,
    demo: isDemoUser(req),
  });

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

      finalText = await streamAiToWriter(writeEvent, model, { system, userContent, ...sOpts });

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
