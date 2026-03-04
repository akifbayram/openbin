import fs from 'node:fs/promises';
import { Router } from 'express';
import { query } from '../db.js';
import { validateEndpointUrl } from '../lib/aiCaller.js';
import { buildCommandContext, buildInventoryContext, fetchExistingTags } from '../lib/aiContext.js';
import { buildSystemPrompt as buildAnalysisPrompt, buildAnalysisUserText } from '../lib/aiProviders.js';
import { aiRouteHandler, validateTextInput } from '../lib/aiRouteHandler.js';
import { CommandResultSchema, QueryResultSchema } from '../lib/aiSchemas.js';
import type { UserAiSettings } from '../lib/aiSettings.js';
import { getUserAiSettings } from '../lib/aiSettings.js';
import { initSseResponse, pipeAiStreamToResponse } from '../lib/aiStream.js';
import type { CommandRequest } from '../lib/commandParser.js';
import { buildSystemPrompt as buildCommandSysPrompt, buildUserMessage as buildCommandUserMsg } from '../lib/commandParser.js';
import { config } from '../lib/config.js';
import { AI_CORRECTION_PREAMBLE } from '../lib/defaultPrompts.js';
import { buildSystemPrompt as buildQuerySysPrompt, buildUserMessage as buildQueryUserMsg } from '../lib/inventoryQuery.js';
import { safePath } from '../lib/pathSafety.js';
import { aiLimiter } from '../lib/rateLimiters.js';
import { createSdkModel } from '../lib/sdkProviderFactory.js';
import { buildPrompt as buildStructurePrompt } from '../lib/structureText.js';
import { memoryPhotoUpload, PHOTO_STORAGE_PATH } from '../lib/uploadConfig.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';

const streamRouter = Router();
streamRouter.use(authenticate);

/** Send a fake SSE analysis response (mock mode). */
async function sendMockAnalysisStream(res: import('express').Response): Promise<void> {
  const writeEvent = initSseResponse(res);
  const mockResult = {
    name: `Test Bin ${Date.now().toString(36).slice(-4).toUpperCase()}`,
    items: ['Screwdriver', 'Wrench set', 'Duct tape', 'Cable ties'],
    tags: ['tools', 'hardware'],
    notes: 'Mock AI analysis — generated without an API call.',
  };
  const json = JSON.stringify(mockResult);
  const chunkSize = 20;
  for (let i = 0; i < json.length; i += chunkSize) {
    writeEvent({ type: 'delta', text: json.slice(i, i + chunkSize) });
    await new Promise((r) => setTimeout(r, 30));
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
    ...streamOpts(settings),
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

  await pipeAiStreamToResponse(res, model, {
    schema: CommandResultSchema,
    system: buildCommandSysPrompt(request, settings.command_prompt ?? undefined),
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
  if (config.aiMock) { await sendMockAnalysisStream(res); return; }

  const { settings, model } = await resolveUserModel(req.user!.id);

  const locationId = req.body?.locationId;
  // Verify location membership if locationId is provided (prevents tag enumeration from other locations)
  if (locationId) {
    const { verifyLocationMembership } = await import('../lib/binAccess.js');
    if (!await verifyLocationMembership(locationId, req.user!.id)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
      return;
    }
  }
  const existingTags = locationId ? await fetchExistingTags(locationId) : undefined;

  const imageParts = allFiles.map((f) => ({
    type: 'image' as const,
    image: f.buffer,
    mimeType: f.mimetype,
  }));

  await pipeAiStreamToResponse(res, model, {
    system: buildAnalysisPrompt(existingTags, settings.custom_prompt),
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
  if (config.aiMock) { await sendMockAnalysisStream(res); return; }

  const { settings, model } = await resolveUserModel(req.user!.id);

  // Batch-fetch all photo metadata in a single query
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const photoResult = await query(
    `SELECT p.id, p.storage_path, p.mime_type, b.location_id FROM photos p
     JOIN bins b ON b.id = p.bin_id
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $${ids.length + 1}
     WHERE p.id IN (${placeholders})`,
    [...ids, req.user!.id]
  );

  if (photoResult.rows.length !== ids.length) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Photo not found or access denied' });
    return;
  }

  const locationId: string = photoResult.rows[0].location_id;

  // Read files + fetch tags in parallel
  const [imageBuffers, existingTags] = await Promise.all([
    Promise.all(
      photoResult.rows.map(async (row) => {
        const filePath = safePath(PHOTO_STORAGE_PATH, row.storage_path);
        if (!filePath) {
          throw Object.assign(new Error('Invalid photo path'), { statusCode: 404 });
        }
        const buffer = await fs.readFile(filePath);
        return { buffer, mimeType: row.mime_type };
      })
    ).catch((err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT' || (err as { statusCode?: number }).statusCode === 404) {
        return null;
      }
      throw err;
    }),
    fetchExistingTags(locationId),
  ]);

  if (!imageBuffers) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Photo file not found on disk' });
    return;
  }

  const imageParts = imageBuffers.map((img) => ({
    type: 'image' as const,
    image: img.buffer,
    mimeType: img.mimeType,
  }));

  await pipeAiStreamToResponse(res, model, {
    system: buildAnalysisPrompt(existingTags, settings.custom_prompt),
    userContent: [...imageParts, { type: 'text' as const, text: buildAnalysisUserText(imageBuffers.length) }],
    ...streamOpts(settings, { maxTokens: imageBuffers.length > 1 ? 2000 : 1500 }),
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

  // Mock mode
  if (config.aiMock) {
    const writeEvent = initSseResponse(res);
    const mockResult = {
      name: previousResult.name,
      items: [...(previousResult.items as string[]).slice(0, -1), 'Corrected item'],
      tags: previousResult.tags || [],
      notes: `Corrected: ${correctionText.slice(0, 50)}`,
    };
    const json = JSON.stringify(mockResult);
    const chunkSize = 20;
    for (let i = 0; i < json.length; i += chunkSize) {
      writeEvent({ type: 'delta', text: json.slice(i, i + chunkSize) });
      await new Promise((r) => setTimeout(r, 30));
    }
    writeEvent({ type: 'done', text: json });
    res.end();
    return;
  }

  const { settings, model } = await resolveUserModel(req.user!.id);

  // Optional location membership check + tag fetch
  let existingTags: string[] | undefined;
  if (locationId) {
    const { verifyLocationMembership } = await import('../lib/binAccess.js');
    if (!await verifyLocationMembership(locationId, req.user!.id)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this location' });
      return;
    }
    existingTags = await fetchExistingTags(locationId);
  }

  const basePrompt = buildAnalysisPrompt(existingTags, settings.custom_prompt);
  const system = `${basePrompt}\n\n${AI_CORRECTION_PREAMBLE}`;

  const userMessage = `Previous analysis result:\n${JSON.stringify(previousResult, null, 2)}\n\nUser correction: ${correctionText}`;

  await pipeAiStreamToResponse(res, model, {
    system,
    userContent: userMessage,
    ...streamOpts(settings, { maxTokens: 1500 }),
  });
}));

export { streamRouter };
