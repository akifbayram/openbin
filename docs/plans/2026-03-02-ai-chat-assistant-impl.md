# AI Chat Assistant Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-turn "Ask AI" command dialog with a multi-turn streaming chat assistant that uses tool calling to query and modify inventory.

**Architecture:** SSE streaming from Express to React. Server calls AI provider with tool definitions, executes read-only tools automatically (search/get), pauses on write tools (create/update/delete) for user confirmation. Conversation history is session-only (React state). The existing `commandExecutor.ts` handles all write tool execution.

**Tech Stack:** Express 4 SSE, React 18, existing `aiCaller.ts` extended with streaming, existing `commandExecutor.ts` for action execution.

---

### Task 1: Streaming AI Provider Caller

Create `server/src/lib/aiStreamingCaller.ts` -- extends the existing `aiCaller.ts` with streaming + tool calling support for all 4 providers.

**Files:**
- Create: `server/src/lib/aiStreamingCaller.ts`

**Step 1: Create the streaming caller module**

This module provides `callAiProviderStreaming()` which returns an async generator of normalized stream events. It supports tool definitions and handles provider-specific streaming formats.

```typescript
// server/src/lib/aiStreamingCaller.ts
import type { AiProviderConfig, AiProviderType } from './aiCaller.js';
import { AiAnalysisError } from './aiCaller.js';

// --- Public types ---

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

export type StreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call'; id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'done'; finishReason: string }
  | { type: 'error'; message: string; code: string };

export interface StreamingCallRequest {
  config: AiProviderConfig;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeoutMs?: number;
}

// --- Provider body builders (streaming variants) ---

function buildOpenAiStreamBody(req: StreamingCallRequest): object {
  const body: Record<string, unknown> = {
    model: req.config.model,
    stream: true,
    messages: req.messages.map(toOpenAiMessage),
  };
  if (req.maxTokens) body.max_tokens = req.maxTokens;
  if (req.temperature != null) body.temperature = req.temperature;
  if (req.topP != null) body.top_p = req.topP;
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }
  return body;
}

function toOpenAiMessage(msg: ChatMessage): Record<string, unknown> {
  if (msg.role === 'tool') {
    return { role: 'tool', tool_call_id: msg.tool_call_id, content: msg.content ?? '' };
  }
  if (msg.role === 'assistant' && msg.tool_calls) {
    return {
      role: 'assistant',
      content: msg.content ?? null,
      tool_calls: msg.tool_calls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: tc.function,
      })),
    };
  }
  return { role: msg.role, content: msg.content ?? '' };
}

function buildAnthropicStreamBody(req: StreamingCallRequest): object {
  // Anthropic separates system prompt from messages
  const systemMessages: string[] = [];
  const messages: Array<Record<string, unknown>> = [];

  for (const msg of req.messages) {
    if (msg.role === 'system') {
      systemMessages.push(msg.content ?? '');
    } else if (msg.role === 'tool') {
      messages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: msg.tool_call_id, content: msg.content ?? '' }],
      });
    } else if (msg.role === 'assistant' && msg.tool_calls) {
      const content: unknown[] = [];
      if (msg.content) content.push({ type: 'text', text: msg.content });
      for (const tc of msg.tool_calls) {
        content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input: JSON.parse(tc.function.arguments) });
      }
      messages.push({ role: 'assistant', content });
    } else {
      messages.push({ role: msg.role, content: msg.content ?? '' });
    }
  }

  const body: Record<string, unknown> = {
    model: req.config.model,
    stream: true,
    max_tokens: req.maxTokens ?? 4096,
    messages,
  };
  if (systemMessages.length) body.system = systemMessages.join('\n\n');
  if (req.temperature != null) body.temperature = req.temperature;
  if (req.topP != null) body.top_p = req.topP;
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }
  return body;
}

function buildGeminiStreamBody(req: StreamingCallRequest): object {
  const contents: Array<Record<string, unknown>> = [];
  let systemText = '';

  for (const msg of req.messages) {
    if (msg.role === 'system') {
      systemText += (systemText ? '\n\n' : '') + (msg.content ?? '');
    } else if (msg.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.content ?? '' }] });
    } else if (msg.role === 'assistant' && msg.tool_calls) {
      const parts: unknown[] = [];
      if (msg.content) parts.push({ text: msg.content });
      for (const tc of msg.tool_calls) {
        parts.push({ functionCall: { name: tc.function.name, args: JSON.parse(tc.function.arguments) } });
      }
      contents.push({ role: 'model', parts });
    } else if (msg.role === 'tool') {
      contents.push({
        role: 'function',
        parts: [{ functionResponse: { name: 'tool', response: { content: msg.content ?? '' } } }],
      });
    } else if (msg.role === 'assistant') {
      contents.push({ role: 'model', parts: [{ text: msg.content ?? '' }] });
    }
  }

  const body: Record<string, unknown> = { contents };
  if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };

  const genConfig: Record<string, unknown> = {};
  if (req.maxTokens) genConfig.maxOutputTokens = req.maxTokens;
  if (req.temperature != null) genConfig.temperature = req.temperature;
  if (req.topP != null) genConfig.topP = req.topP;
  if (Object.keys(genConfig).length) body.generationConfig = genConfig;

  if (req.tools?.length) {
    body.tools = [{
      functionDeclarations: req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    }];
  }
  return body;
}

// --- Provider URL + headers (streaming variants) ---

function getStreamingProviderRequest(config: AiProviderConfig, body: object): { url: string; headers: Record<string, string>; body: string } {
  if (config.provider === 'anthropic') {
    const baseUrl = config.endpointUrl || 'https://api.anthropic.com';
    return {
      url: `${baseUrl.replace(/\/+$/, '')}/v1/messages`,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    };
  }
  if (config.provider === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse`,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify(body),
    };
  }
  // OpenAI + openai-compatible
  const baseUrl = config.endpointUrl || 'https://api.openai.com/v1';
  return {
    url: `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  };
}

// --- SSE line parser ---

async function* parseSSELines(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        const data = trimmed.slice(6);
        if (data !== '[DONE]') yield data;
      }
    }
  }
  if (buffer.trim().startsWith('data: ')) {
    const data = buffer.trim().slice(6);
    if (data !== '[DONE]') yield data;
  }
}

// --- Provider-specific stream event parsers ---

function mapHttpStatus(status: number): string {
  if (status === 401 || status === 403) return 'INVALID_KEY';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 404) return 'MODEL_NOT_FOUND';
  return 'PROVIDER_ERROR';
}

async function* parseOpenAiStream(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<StreamEvent> {
  // Accumulate partial tool calls across chunks
  const toolCallAccum = new Map<number, { id: string; name: string; args: string }>();
  let hasToolCalls = false;

  for await (const data of parseSSELines(reader)) {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(data); } catch { continue; }

    const choice = (parsed.choices as Array<Record<string, unknown>>)?.[0];
    if (!choice) continue;

    const delta = choice.delta as Record<string, unknown> | undefined;
    const finishReason = choice.finish_reason as string | null;

    if (delta?.content) {
      yield { type: 'text_delta', delta: delta.content as string };
    }

    // Accumulate tool calls from deltas
    const toolCalls = delta?.tool_calls as Array<Record<string, unknown>> | undefined;
    if (toolCalls) {
      hasToolCalls = true;
      for (const tc of toolCalls) {
        const idx = tc.index as number;
        if (!toolCallAccum.has(idx)) {
          toolCallAccum.set(idx, { id: (tc.id as string) ?? '', name: '', args: '' });
        }
        const acc = toolCallAccum.get(idx)!;
        if (tc.id) acc.id = tc.id as string;
        const fn = tc.function as Record<string, unknown> | undefined;
        if (fn?.name) acc.name = fn.name as string;
        if (fn?.arguments) acc.args += fn.arguments as string;
      }
    }

    if (finishReason === 'tool_calls' || (finishReason === 'stop' && hasToolCalls)) {
      for (const [, tc] of toolCallAccum) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.args); } catch { /* empty */ }
        yield { type: 'tool_call', id: tc.id, name: tc.name, arguments: args };
      }
      yield { type: 'done', finishReason: finishReason ?? 'tool_calls' };
      return;
    }

    if (finishReason === 'stop') {
      yield { type: 'done', finishReason: 'stop' };
      return;
    }
  }
  yield { type: 'done', finishReason: 'stop' };
}

async function* parseAnthropicStream(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<StreamEvent> {
  const decoder = new TextDecoder();
  let buffer = '';
  let currentToolId = '';
  let currentToolName = '';
  let toolArgsAccum = '';

  const lines = async function* () {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const p of parts) yield p.trim();
    }
    if (buffer.trim()) yield buffer.trim();
  };

  let currentEventType = '';

  for await (const line of lines()) {
    if (line.startsWith('event: ')) {
      currentEventType = line.slice(7);
      continue;
    }
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6);

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(data); } catch { continue; }

    if (currentEventType === 'content_block_start') {
      const block = parsed.content_block as Record<string, unknown> | undefined;
      if (block?.type === 'tool_use') {
        currentToolId = block.id as string;
        currentToolName = block.name as string;
        toolArgsAccum = '';
      }
    } else if (currentEventType === 'content_block_delta') {
      const delta = parsed.delta as Record<string, unknown> | undefined;
      if (delta?.type === 'text_delta') {
        yield { type: 'text_delta', delta: delta.text as string };
      } else if (delta?.type === 'input_json_delta') {
        toolArgsAccum += delta.partial_json as string;
      }
    } else if (currentEventType === 'content_block_stop') {
      if (currentToolId) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(toolArgsAccum); } catch { /* empty */ }
        yield { type: 'tool_call', id: currentToolId, name: currentToolName, arguments: args };
        currentToolId = '';
        currentToolName = '';
        toolArgsAccum = '';
      }
    } else if (currentEventType === 'message_delta') {
      const delta = parsed.delta as Record<string, unknown> | undefined;
      if (delta?.stop_reason) {
        yield { type: 'done', finishReason: delta.stop_reason as string };
        return;
      }
    } else if (currentEventType === 'message_stop') {
      yield { type: 'done', finishReason: 'end_turn' };
      return;
    }
  }
  yield { type: 'done', finishReason: 'end_turn' };
}

async function* parseGeminiStream(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<StreamEvent> {
  for await (const data of parseSSELines(reader)) {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(data); } catch { continue; }

    const candidates = parsed.candidates as Array<Record<string, unknown>> | undefined;
    if (!candidates?.length) continue;

    const candidate = candidates[0];
    const content = candidate.content as Record<string, unknown> | undefined;
    const parts = content?.parts as Array<Record<string, unknown>> | undefined;

    if (parts) {
      for (const part of parts) {
        if (part.text) {
          yield { type: 'text_delta', delta: part.text as string };
        }
        if (part.functionCall) {
          const fc = part.functionCall as Record<string, unknown>;
          yield {
            type: 'tool_call',
            id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: fc.name as string,
            arguments: (fc.args as Record<string, unknown>) ?? {},
          };
        }
      }
    }

    const finishReason = candidate.finishReason as string | undefined;
    if (finishReason && finishReason !== 'FINISH_REASON_UNSPECIFIED') {
      yield { type: 'done', finishReason };
      return;
    }
  }
  yield { type: 'done', finishReason: 'STOP' };
}

// --- Main entry point ---

export async function* callAiProviderStreaming(
  request: StreamingCallRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const { config } = request;

  let body: object;
  if (config.provider === 'anthropic') {
    body = buildAnthropicStreamBody(request);
  } else if (config.provider === 'gemini') {
    body = buildGeminiStreamBody(request);
  } else {
    body = buildOpenAiStreamBody(request);
  }

  const req = getStreamingProviderRequest(config, body);

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers: req.headers,
    body: req.body,
  };
  if (signal) fetchOptions.signal = signal;
  else if (request.timeoutMs) fetchOptions.signal = AbortSignal.timeout(request.timeoutMs);

  let res: Response;
  try {
    res = await fetch(req.url, fetchOptions);
  } catch (err) {
    const msg = (err as Error).name === 'TimeoutError'
      ? `Request timed out after ${Math.round((request.timeoutMs || 0) / 1000)}s`
      : (err as Error).name === 'AbortError'
        ? 'Request aborted'
        : `Failed to connect: ${(err as Error).message}`;
    yield { type: 'error', message: msg, code: 'NETWORK_ERROR' };
    return;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    yield { type: 'error', message: `Provider returned ${res.status}: ${text.slice(0, 200)}`, code: mapHttpStatus(res.status) };
    return;
  }

  if (!res.body) {
    yield { type: 'error', message: 'No response body from provider', code: 'PROVIDER_ERROR' };
    return;
  }

  const reader = res.body.getReader();

  try {
    if (config.provider === 'anthropic') {
      yield* parseAnthropicStream(reader);
    } else if (config.provider === 'gemini') {
      yield* parseGeminiStream(reader);
    } else {
      yield* parseOpenAiStream(reader);
    }
  } finally {
    reader.releaseLock();
  }
}
```

**Step 2: Verify it compiles**

Run: `cd server && npx tsc --noEmit`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add server/src/lib/aiStreamingCaller.ts
git commit -m "feat(ai): add streaming provider caller with tool calling support"
```

---

### Task 2: Chat Tool Definitions and Executor

Create `server/src/lib/chatTools.ts` -- defines the tools the AI assistant can call and executes them server-side.

**Files:**
- Create: `server/src/lib/chatTools.ts`

**Step 1: Create the chat tools module**

This module defines tool schemas (provider-agnostic JSON Schema) and maps tool calls to existing server-side operations. Read-only tools execute DB queries directly. Write tools delegate to `commandExecutor.ts`.

```typescript
// server/src/lib/chatTools.ts
import { query } from '../db.js';
import type { ToolDefinition } from './aiStreamingCaller.js';
import { executeActions, type ActionResult } from './commandExecutor.js';
import type { CommandAction } from './commandParser.js';

// --- Tool categorization ---

const READ_ONLY_TOOLS = new Set(['search_bins', 'get_bin', 'search_items', 'list_areas', 'list_tags']);

export function isReadOnlyTool(name: string): boolean {
  return READ_ONLY_TOOLS.has(name);
}

// --- Tool definitions ---

export function getChatToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: 'search_bins',
      description: 'Search bins by name, items, tags, or notes. Returns matching bins with their contents.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search text to match against bin names, items, tags, and notes' },
          tag: { type: 'string', description: 'Filter by a specific tag' },
          area_name: { type: 'string', description: 'Filter by area name' },
          limit: { type: 'number', description: 'Max results to return (default 20, max 50)' },
        },
      },
    },
    {
      name: 'get_bin',
      description: 'Get full details of a single bin by its ID (short code).',
      parameters: {
        type: 'object',
        properties: {
          bin_id: { type: 'string', description: 'The bin ID (6-character short code)' },
        },
        required: ['bin_id'],
      },
    },
    {
      name: 'search_items',
      description: 'Search for specific items across all bins. Returns items with the bin they belong to.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Item name to search for' },
          limit: { type: 'number', description: 'Max results (default 20, max 50)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'list_areas',
      description: 'List all areas in the current location with their bin counts.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'list_tags',
      description: 'List all tags used in the current location with usage counts.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional filter text for tag names' },
        },
      },
    },
    // --- Write tools ---
    {
      name: 'create_bin',
      description: 'Create a new bin with optional items, tags, area, icon, and color.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Bin name' },
          items: { type: 'array', items: { type: 'string' }, description: 'Items to add' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags to assign' },
          area_name: { type: 'string', description: 'Area name (created if not exists)' },
          notes: { type: 'string', description: 'Notes for the bin' },
          icon: { type: 'string', description: 'Icon name (e.g. Package, Wrench, Shirt)' },
          color: { type: 'string', description: 'Color name (e.g. red, blue, green)' },
        },
        required: ['name'],
      },
    },
    {
      name: 'update_bin',
      description: 'Update a bin\'s properties. Only include fields you want to change.',
      parameters: {
        type: 'object',
        properties: {
          bin_id: { type: 'string', description: 'The bin ID to update' },
          bin_name: { type: 'string', description: 'Current name of the bin (for confirmation)' },
          name: { type: 'string', description: 'New name' },
          notes: { type: 'string', description: 'New notes' },
          area_name: { type: 'string', description: 'New area name' },
          icon: { type: 'string', description: 'New icon' },
          color: { type: 'string', description: 'New color' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Replace all tags' },
        },
        required: ['bin_id', 'bin_name'],
      },
    },
    {
      name: 'delete_bin',
      description: 'Soft-delete a bin (moves to trash, can be restored).',
      parameters: {
        type: 'object',
        properties: {
          bin_id: { type: 'string', description: 'The bin ID to delete' },
          bin_name: { type: 'string', description: 'Name of the bin (for confirmation)' },
        },
        required: ['bin_id', 'bin_name'],
      },
    },
    {
      name: 'add_items',
      description: 'Add items to an existing bin.',
      parameters: {
        type: 'object',
        properties: {
          bin_id: { type: 'string', description: 'The bin ID' },
          bin_name: { type: 'string', description: 'Name of the bin' },
          items: { type: 'array', items: { type: 'string' }, description: 'Item names to add' },
        },
        required: ['bin_id', 'bin_name', 'items'],
      },
    },
    {
      name: 'remove_items',
      description: 'Remove items from a bin by name.',
      parameters: {
        type: 'object',
        properties: {
          bin_id: { type: 'string', description: 'The bin ID' },
          bin_name: { type: 'string', description: 'Name of the bin' },
          items: { type: 'array', items: { type: 'string' }, description: 'Item names to remove' },
        },
        required: ['bin_id', 'bin_name', 'items'],
      },
    },
    {
      name: 'set_area',
      description: 'Move a bin to a different area.',
      parameters: {
        type: 'object',
        properties: {
          bin_id: { type: 'string', description: 'The bin ID' },
          bin_name: { type: 'string', description: 'Name of the bin' },
          area_name: { type: 'string', description: 'Target area name (created if not exists)' },
        },
        required: ['bin_id', 'bin_name', 'area_name'],
      },
    },
    {
      name: 'add_tags',
      description: 'Add tags to a bin (merges with existing).',
      parameters: {
        type: 'object',
        properties: {
          bin_id: { type: 'string', description: 'The bin ID' },
          bin_name: { type: 'string', description: 'Name of the bin' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags to add' },
        },
        required: ['bin_id', 'bin_name', 'tags'],
      },
    },
    {
      name: 'remove_tags',
      description: 'Remove tags from a bin.',
      parameters: {
        type: 'object',
        properties: {
          bin_id: { type: 'string', description: 'The bin ID' },
          bin_name: { type: 'string', description: 'Name of the bin' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags to remove' },
        },
        required: ['bin_id', 'bin_name', 'tags'],
      },
    },
    {
      name: 'create_area',
      description: 'Create a new area in the current location.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Area name' },
        },
        required: ['name'],
      },
    },
  ];
}

// --- Read-only tool executors ---

async function executeSearchBins(args: Record<string, unknown>, locationId: string, userId: string): Promise<string> {
  const q = (args.query as string) || '';
  const tag = args.tag as string | undefined;
  const areaName = args.area_name as string | undefined;
  const limit = Math.min(Math.max((args.limit as number) || 20, 1), 50);

  let areaId: string | undefined;
  if (areaName) {
    const areaResult = await query('SELECT id FROM areas WHERE location_id = $1 AND LOWER(name) = LOWER($2)', [locationId, areaName]);
    if (areaResult.rows.length) areaId = areaResult.rows[0].id as string;
  }

  let sql = `SELECT b.id, b.name, COALESCE(a.name, '') AS area_name,
    COALESCE((SELECT json_group_array(json_object('id', bi.id, 'name', bi.name)) FROM (SELECT id, name FROM bin_items bi WHERE bi.bin_id = b.id ORDER BY bi.position) bi), '[]') AS items,
    b.tags, b.notes, b.icon, b.color
    FROM bins b LEFT JOIN areas a ON a.id = b.area_id
    WHERE b.location_id = $1 AND b.deleted_at IS NULL AND (b.visibility = 'location' OR b.created_by = $2)`;
  const params: unknown[] = [locationId, userId];
  let paramIdx = 3;

  if (q) {
    sql += ` AND (b.name LIKE $${paramIdx} OR b.notes LIKE $${paramIdx} OR EXISTS (SELECT 1 FROM bin_items bi WHERE bi.bin_id = b.id AND bi.name LIKE $${paramIdx}))`;
    params.push(`%${q}%`);
    paramIdx++;
  }
  if (tag) {
    sql += ` AND EXISTS (SELECT 1 FROM json_each(b.tags) je WHERE LOWER(je.value) = LOWER($${paramIdx}))`;
    params.push(tag);
    paramIdx++;
  }
  if (areaId) {
    sql += ` AND b.area_id = $${paramIdx}`;
    params.push(areaId);
    paramIdx++;
  }

  sql += ` ORDER BY b.updated_at DESC LIMIT $${paramIdx}`;
  params.push(limit);

  const result = await query(sql, params);
  const bins = result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    area_name: r.area_name,
    items: (r.items as Array<{ id: string; name: string }>).map((i) => i.name),
    tags: r.tags,
    notes: typeof r.notes === 'string' && r.notes.length > 100 ? r.notes.slice(0, 100) + '...' : r.notes,
    icon: r.icon,
    color: r.color,
  }));

  return JSON.stringify({ bins, count: bins.length });
}

async function executeGetBin(args: Record<string, unknown>, locationId: string, userId: string): Promise<string> {
  const binId = args.bin_id as string;
  const result = await query(
    `SELECT b.id, b.name, COALESCE(a.name, '') AS area_name,
      COALESCE((SELECT json_group_array(json_object('id', bi.id, 'name', bi.name)) FROM (SELECT id, name FROM bin_items bi WHERE bi.bin_id = b.id ORDER BY bi.position) bi), '[]') AS items,
      b.tags, b.notes, b.icon, b.color, b.visibility, b.created_at, b.updated_at
      FROM bins b LEFT JOIN areas a ON a.id = b.area_id
      WHERE b.id = $1 AND b.location_id = $2 AND b.deleted_at IS NULL AND (b.visibility = 'location' OR b.created_by = $3)`,
    [binId, locationId, userId]
  );
  if (!result.rows.length) return JSON.stringify({ error: 'Bin not found' });
  const r = result.rows[0];
  return JSON.stringify({
    id: r.id, name: r.name, area_name: r.area_name,
    items: (r.items as Array<{ id: string; name: string }>).map((i) => i.name),
    tags: r.tags, notes: r.notes, icon: r.icon, color: r.color,
    visibility: r.visibility, created_at: r.created_at, updated_at: r.updated_at,
  });
}

async function executeSearchItems(args: Record<string, unknown>, locationId: string, userId: string): Promise<string> {
  const q = args.query as string;
  const limit = Math.min(Math.max((args.limit as number) || 20, 1), 50);
  const result = await query(
    `SELECT bi.name AS item_name, b.id AS bin_id, b.name AS bin_name, COALESCE(a.name, '') AS area_name
      FROM bin_items bi
      JOIN bins b ON b.id = bi.bin_id
      LEFT JOIN areas a ON a.id = b.area_id
      WHERE b.location_id = $1 AND b.deleted_at IS NULL AND (b.visibility = 'location' OR b.created_by = $2)
      AND bi.name LIKE $3
      ORDER BY bi.name LIMIT $4`,
    [locationId, userId, `%${q}%`, limit]
  );
  return JSON.stringify({ items: result.rows, count: result.rows.length });
}

async function executeListAreas(locationId: string): Promise<string> {
  const result = await query(
    `SELECT a.id, a.name, COUNT(b.id) AS bin_count
      FROM areas a LEFT JOIN bins b ON b.area_id = a.id AND b.deleted_at IS NULL
      WHERE a.location_id = $1 GROUP BY a.id ORDER BY a.name`,
    [locationId]
  );
  return JSON.stringify({ areas: result.rows, count: result.rows.length });
}

async function executeListTags(args: Record<string, unknown>, locationId: string): Promise<string> {
  const q = args.query as string | undefined;
  let sql = `SELECT je.value AS tag, COUNT(*) AS count
    FROM bins, json_each(bins.tags) je
    WHERE bins.location_id = $1 AND bins.deleted_at IS NULL`;
  const params: unknown[] = [locationId];
  if (q) {
    sql += ` AND LOWER(je.value) LIKE LOWER($2)`;
    params.push(`%${q}%`);
  }
  sql += ' GROUP BY LOWER(je.value) ORDER BY count DESC';
  const result = await query(sql, params);
  return JSON.stringify({ tags: result.rows, count: result.rows.length });
}

// --- Public API ---

/** Execute a read-only tool and return the JSON result string. */
export async function executeReadOnlyTool(
  name: string,
  args: Record<string, unknown>,
  locationId: string,
  userId: string,
): Promise<string> {
  switch (name) {
    case 'search_bins': return executeSearchBins(args, locationId, userId);
    case 'get_bin': return executeGetBin(args, locationId, userId);
    case 'search_items': return executeSearchItems(args, locationId, userId);
    case 'list_areas': return executeListAreas(locationId);
    case 'list_tags': return executeListTags(args, locationId);
    default: return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

/** Convert a write tool call to a CommandAction for preview/execution. */
export function toolCallToCommandAction(name: string, args: Record<string, unknown>): CommandAction {
  switch (name) {
    case 'create_bin':
      return { type: 'create_bin', name: args.name as string, area_name: args.area_name as string | undefined, items: args.items as string[] | undefined, tags: args.tags as string[] | undefined, notes: args.notes as string | undefined, icon: args.icon as string | undefined, color: args.color as string | undefined };
    case 'update_bin':
      return { type: 'update_bin', bin_id: args.bin_id as string, bin_name: args.bin_name as string, name: args.name as string | undefined, notes: args.notes as string | undefined, area_name: args.area_name as string | undefined, icon: args.icon as string | undefined, color: args.color as string | undefined, tags: args.tags as string[] | undefined };
    case 'delete_bin':
      return { type: 'delete_bin', bin_id: args.bin_id as string, bin_name: args.bin_name as string };
    case 'add_items':
      return { type: 'add_items', bin_id: args.bin_id as string, bin_name: args.bin_name as string, items: args.items as string[] };
    case 'remove_items':
      return { type: 'remove_items', bin_id: args.bin_id as string, bin_name: args.bin_name as string, items: args.items as string[] };
    case 'set_area':
      return { type: 'set_area', bin_id: args.bin_id as string, bin_name: args.bin_name as string, area_id: null, area_name: args.area_name as string };
    case 'add_tags':
      return { type: 'add_tags', bin_id: args.bin_id as string, bin_name: args.bin_name as string, tags: args.tags as string[] };
    case 'remove_tags':
      return { type: 'remove_tags', bin_id: args.bin_id as string, bin_name: args.bin_name as string, tags: args.tags as string[] };
    case 'create_area':
      // Map to set_area with a dummy bin -- this actually needs special handling
      // For now, we'll handle area creation in the route directly
      return { type: 'create_bin', name: '__area_only__' } as CommandAction;
    default:
      throw new Error(`Cannot convert tool "${name}" to CommandAction`);
  }
}

/** Execute write actions via commandExecutor. Returns results. */
export async function executeWriteActions(
  actions: CommandAction[],
  locationId: string,
  userId: string,
  userName: string,
  authMethod?: 'jwt' | 'api_key',
  apiKeyId?: string,
): Promise<ActionResult[]> {
  const result = await executeActions(actions, locationId, userId, userName, authMethod, apiKeyId);
  return result.executed;
}
```

**Step 2: Verify it compiles**

Run: `cd server && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add server/src/lib/chatTools.ts
git commit -m "feat(ai): add chat tool definitions and executor"
```

---

### Task 3: Chat SSE Endpoint

Add `POST /api/ai/chat` and `POST /api/ai/chat/confirm` routes to `server/src/routes/ai.ts`.

**Files:**
- Modify: `server/src/routes/ai.ts` -- add 2 new route handlers

**Step 1: Add the chat endpoint**

The chat route accepts conversation messages and a locationId, builds a system prompt with location context, calls the AI provider with streaming + tools, executes read-only tools automatically, and streams write tool previews to the client for confirmation. A separate `/chat/confirm` endpoint handles action confirmations.

Add these imports at the top of `ai.ts`:
```typescript
import { callAiProviderStreaming, type ChatMessage as ProviderChatMessage } from '../lib/aiStreamingCaller.js';
import { getChatToolDefinitions, isReadOnlyTool, executeReadOnlyTool, toolCallToCommandAction, executeWriteActions } from '../lib/chatTools.js';
```

Add these types near the top:
```typescript
interface ChatRequestMessage {
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  toolCallId?: string;
  toolResults?: Array<{ binId: string; binName: string; areaName: string; items: string[]; tags: string[] }>;
  actionPreviews?: Array<{ id: string; toolName: string; args: Record<string, unknown>; description: string }>;
}

// In-memory store for pending confirmations (keyed by confirmation ID)
const pendingConfirmations = new Map<string, {
  resolve: (accepted: boolean) => void;
  timeout: ReturnType<typeof setTimeout>;
}>();
```

Add the chat route before the `export { router as aiRouter }` at the end:
```typescript
// POST /api/ai/chat — streaming chat with tool calling
router.post('/chat', aiLimiter, aiRouteHandler('chat', async (req, res) => {
  const userId = req.user!.id;
  const userName = req.user!.username;
  const { messages, locationId } = req.body as { messages: ChatRequestMessage[]; locationId: string };

  if (!locationId || typeof locationId !== 'string') throw new ValidationError('locationId is required');
  if (!Array.isArray(messages) || messages.length === 0) throw new ValidationError('messages array is required');

  const settings = await getUserAiSettings(userId);

  // Build system prompt with location context
  const [locationResult, areasResult, tagsResult] = await Promise.all([
    query('SELECT name, term_bin, term_location, term_area FROM locations WHERE id = $1', [locationId]),
    query('SELECT id, name FROM areas WHERE location_id = $1 ORDER BY name', [locationId]),
    query(
      `SELECT je.value AS tag, COUNT(*) AS count FROM bins, json_each(bins.tags) je
       WHERE bins.location_id = $1 AND bins.deleted_at IS NULL GROUP BY LOWER(je.value) ORDER BY count DESC LIMIT 50`,
      [locationId]
    ),
  ]);

  const loc = locationResult.rows[0];
  if (!loc) throw new ValidationError('Location not found');

  const termBin = (loc.term_bin as string) || 'bin';
  const termArea = (loc.term_area as string) || 'area';
  const termLocation = (loc.term_location as string) || 'location';
  const areaNames = areasResult.rows.map((r) => r.name as string);
  const tagNames = tagsResult.rows.map((r) => r.tag as string);

  const systemPrompt = `You are the OpenBin assistant. You help users manage their physical storage inventory.
You have access to tools to search, create, and modify ${termBin}s, items, ${termArea}s, and tags.

Current ${termLocation}: ${loc.name}
Available ${termArea}s: ${areaNames.length ? areaNames.join(', ') : 'none yet'}
Existing tags: ${tagNames.length ? tagNames.join(', ') : 'none yet'}
Terminology: "${termBin}" means a storage container, "${termArea}" means a room or zone, "${termLocation}" means the overall space.

Guidelines:
- Use search tools before making changes to verify you're acting on the right ${termBin}s.
- When suggesting changes, be specific about what will change.
- After completing actions, summarize what was done.
- If the user's request is ambiguous, ask for clarification.
- Keep responses concise and helpful.
- When showing search results, mention the ${termBin} names and relevant details.`;

  // Convert client messages to provider format
  const providerMessages: ProviderChatMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      providerMessages.push({ role: 'user', content: msg.content ?? '' });
    } else if (msg.role === 'assistant') {
      if (msg.toolCalls?.length) {
        providerMessages.push({
          role: 'assistant',
          content: msg.content ?? undefined,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        });
      } else {
        providerMessages.push({ role: 'assistant', content: msg.content ?? '' });
      }
    } else if (msg.role === 'tool') {
      providerMessages.push({ role: 'tool', tool_call_id: msg.toolCallId, content: msg.content ?? '' });
    }
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  const tools = getChatToolDefinitions();
  const maxIterations = 10; // Safety limit on tool call loops

  try {
    let currentMessages = [...providerMessages];

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const stream = callAiProviderStreaming({
        config: settings.config,
        messages: currentMessages,
        tools,
        temperature: settings.temperature ?? 0.3,
        maxTokens: settings.max_tokens ?? 4096,
        topP: settings.top_p ?? undefined,
        timeoutMs: (settings.request_timeout ?? 120) * 1000,
      }, abortController.signal);

      let accumulatedText = '';
      const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
      let isDone = false;

      for await (const event of stream) {
        if (abortController.signal.aborted) {
          res.end();
          return;
        }

        switch (event.type) {
          case 'text_delta':
            accumulatedText += event.delta;
            send('text_delta', { delta: event.delta });
            break;

          case 'tool_call':
            toolCalls.push({ id: event.id, name: event.name, arguments: event.arguments });
            break;

          case 'done':
            isDone = true;
            break;

          case 'error':
            send('error', { message: event.message, code: event.code });
            res.end();
            return;
        }
      }

      // If no tool calls, we're done
      if (toolCalls.length === 0) {
        send('done', {});
        res.end();
        return;
      }

      // Process tool calls
      // Add the assistant message with tool calls to history
      currentMessages.push({
        role: 'assistant',
        content: accumulatedText || undefined,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      });

      // Separate read-only from write tool calls
      const readCalls = toolCalls.filter((tc) => isReadOnlyTool(tc.name));
      const writeCalls = toolCalls.filter((tc) => !isReadOnlyTool(tc.name));

      // Execute read-only tools immediately
      for (const tc of readCalls) {
        try {
          const result = await executeReadOnlyTool(tc.name, tc.arguments, locationId, userId);
          send('tool_result', { toolCallId: tc.id, name: tc.name, result: JSON.parse(result) });
          currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Tool execution failed';
          currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: errMsg }) });
        }
      }

      // Handle write tool calls -- send previews to client
      if (writeCalls.length > 0) {
        const confirmationId = crypto.randomUUID();
        const actions = writeCalls.map((tc) => ({
          id: tc.id,
          toolName: tc.name,
          args: tc.arguments,
          description: describeToolCall(tc.name, tc.arguments),
        }));

        send('action_preview', { confirmationId, actions });

        // Wait for confirmation (with 5-minute timeout)
        const accepted = await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => {
            pendingConfirmations.delete(confirmationId);
            resolve(false);
          }, 5 * 60 * 1000);

          pendingConfirmations.set(confirmationId, { resolve, timeout });
        });

        // Feed results back to AI
        if (accepted) {
          for (const tc of writeCalls) {
            try {
              const action = toolCallToCommandAction(tc.name, tc.arguments);
              const results = await executeWriteActions([action], locationId, userId, userName, req.authMethod, req.apiKeyId);
              const result = results[0];
              currentMessages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify({ success: result.success, details: result.details }),
              });
              send('action_executed', { toolCallId: tc.id, success: result.success, details: result.details });
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : 'Action failed';
              currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: errMsg }) });
            }
          }
        } else {
          for (const tc of writeCalls) {
            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify({ error: 'User rejected this action' }),
            });
          }
          send('action_rejected', { confirmationId });
        }
      }

      // Continue the loop -- AI will generate a follow-up response based on tool results
      if (isDone && writeCalls.length === 0) {
        send('done', {});
        res.end();
        return;
      }
    }

    // Safety: max iterations reached
    send('done', {});
    res.end();
  } catch (err) {
    if (!res.headersSent) throw err;
    // If headers already sent, send error as SSE event
    const msg = err instanceof Error ? err.message : 'Internal error';
    send('error', { message: msg, code: 'INTERNAL_ERROR' });
    res.end();
  }
}));

// POST /api/ai/chat/confirm — confirm or reject pending write actions
router.post('/chat/confirm', authenticate, asyncHandler(async (req, res) => {
  const { confirmationId, accepted } = req.body as { confirmationId: string; accepted: boolean };

  if (!confirmationId || typeof accepted !== 'boolean') {
    throw new ValidationError('confirmationId and accepted are required');
  }

  const pending = pendingConfirmations.get(confirmationId);
  if (!pending) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Confirmation not found or expired' });
    return;
  }

  clearTimeout(pending.timeout);
  pendingConfirmations.delete(confirmationId);
  pending.resolve(accepted);

  res.json({ ok: true });
}));

// Helper to describe a tool call for the action preview
function describeToolCall(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'create_bin': return `Create bin "${args.name}"${args.area_name ? ` in ${args.area_name}` : ''}`;
    case 'update_bin': return `Update bin "${args.bin_name}"`;
    case 'delete_bin': return `Delete bin "${args.bin_name}"`;
    case 'add_items': return `Add ${(args.items as string[])?.length ?? 0} item(s) to "${args.bin_name}"`;
    case 'remove_items': return `Remove ${(args.items as string[])?.length ?? 0} item(s) from "${args.bin_name}"`;
    case 'set_area': return `Move "${args.bin_name}" to ${args.area_name}`;
    case 'add_tags': return `Add tags [${(args.tags as string[])?.join(', ')}] to "${args.bin_name}"`;
    case 'remove_tags': return `Remove tags [${(args.tags as string[])?.join(', ')}] from "${args.bin_name}"`;
    case 'create_area': return `Create area "${args.name}"`;
    default: return `${name} on "${args.bin_name || args.name}"`;
  }
}
```

Note: You'll need to add `import crypto from 'node:crypto';` at the top if not already imported, and ensure `authenticate`, `asyncHandler`, `ValidationError`, `query` are imported (they should be already in the existing file).

**Step 2: Verify it compiles**

Run: `cd server && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add server/src/routes/ai.ts
git commit -m "feat(ai): add streaming chat endpoint with tool calling"
```

---

### Task 4: Client SSE Stream Parser

Create `src/features/ai/chatStreamParser.ts` -- parses SSE events from the chat endpoint.

**Files:**
- Create: `src/features/ai/chatStreamParser.ts`

**Step 1: Create the stream parser**

```typescript
// src/features/ai/chatStreamParser.ts

export interface TextDeltaEvent {
  type: 'text_delta';
  delta: string;
}

export interface ToolResultEvent {
  type: 'tool_result';
  toolCallId: string;
  name: string;
  result: unknown;
}

export interface ActionPreviewEvent {
  type: 'action_preview';
  confirmationId: string;
  actions: Array<{
    id: string;
    toolName: string;
    args: Record<string, unknown>;
    description: string;
  }>;
}

export interface ActionExecutedEvent {
  type: 'action_executed';
  toolCallId: string;
  success: boolean;
  details: string;
}

export interface ActionRejectedEvent {
  type: 'action_rejected';
  confirmationId: string;
}

export interface DoneEvent {
  type: 'done';
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  code: string;
}

export type ChatStreamEvent =
  | TextDeltaEvent
  | ToolResultEvent
  | ActionPreviewEvent
  | ActionExecutedEvent
  | ActionRejectedEvent
  | DoneEvent
  | ErrorEvent;

/**
 * Parse an SSE stream from the chat endpoint into typed events.
 * Yields events as they arrive. Handles connection errors.
 */
export async function* parseChatStream(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  if (!response.body) {
    yield { type: 'error', message: 'No response body', code: 'NETWORK_ERROR' };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) return;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let currentEvent = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('event: ')) {
          currentEvent = trimmed.slice(7);
        } else if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          try {
            const parsed = JSON.parse(data);
            yield { type: currentEvent, ...parsed } as ChatStreamEvent;
          } catch {
            // Skip malformed data
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/features/ai/chatStreamParser.ts
git commit -m "feat(ai): add client-side SSE stream parser for chat"
```

---

### Task 5: useChat Hook

Create `src/features/ai/useChat.ts` -- core state management for the chat panel.

**Files:**
- Create: `src/features/ai/useChat.ts`

**Step 1: Create the useChat hook**

```typescript
// src/features/ai/useChat.ts
import { useCallback, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLocations } from '@/features/locations/useLocations';
import { notify, Events } from '@/lib/eventBus';
import { mapAiError } from './aiErrors';
import { parseChatStream, type ChatStreamEvent } from './chatStreamParser';

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
}

export interface ActionPreview {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  description: string;
}

export interface ChatMessageContent {
  role: 'user' | 'assistant' | 'system';
  text: string;
  toolResults?: ToolResult[];
  actionPreview?: {
    confirmationId: string;
    actions: ActionPreview[];
    status: 'pending' | 'accepted' | 'rejected';
  };
  executedActions?: Array<{ toolCallId: string; success: boolean; details: string }>;
  isStreaming?: boolean;
  error?: string;
}

interface PendingConfirmation {
  confirmationId: string;
  actions: ActionPreview[];
  messageIndex: number;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessageContent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { activeLocation } = useLocations();

  const sendMessage = useCallback(async (text: string) => {
    if (!activeLocation?.id || isStreaming) return;

    const userMessage: ChatMessageContent = { role: 'user', text };
    const assistantMessage: ChatMessageContent = { role: 'assistant', text: '', isStreaming: true };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      // Build API messages from conversation history (excluding the new streaming assistant message)
      const apiMessages = [...messages, userMessage].map((msg) => {
        if (msg.role === 'user') return { role: 'user' as const, content: msg.text };
        if (msg.role === 'assistant') {
          return { role: 'assistant' as const, content: msg.text };
        }
        return { role: msg.role as 'user', content: msg.text };
      });

      // Use fetch directly for SSE streaming (apiFetch doesn't support streaming)
      const token = localStorage.getItem('openbin-token');
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: apiMessages, locationId: activeLocation.id }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Chat request failed' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      let accumulatedText = '';
      const toolResults: ToolResult[] = [];
      const executedActions: Array<{ toolCallId: string; success: boolean; details: string }> = [];

      for await (const event of parseChatStream(response, abortController.signal)) {
        switch (event.type) {
          case 'text_delta':
            accumulatedText += event.delta;
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.role === 'assistant') {
                updated[updated.length - 1] = { ...last, text: accumulatedText };
              }
              return updated;
            });
            break;

          case 'tool_result':
            toolResults.push({
              toolCallId: event.toolCallId,
              name: event.name,
              result: event.result,
            });
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.role === 'assistant') {
                updated[updated.length - 1] = { ...last, toolResults: [...(last.toolResults ?? []), { toolCallId: event.toolCallId, name: event.name, result: event.result }] };
              }
              return updated;
            });
            break;

          case 'action_preview': {
            const confirmation: PendingConfirmation = {
              confirmationId: event.confirmationId,
              actions: event.actions,
              messageIndex: messages.length + 1, // index of the assistant message
            };
            setPendingConfirmation(confirmation);
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  text: accumulatedText,
                  actionPreview: { confirmationId: event.confirmationId, actions: event.actions, status: 'pending' },
                  isStreaming: false,
                };
              }
              return updated;
            });
            setIsStreaming(false);
            return; // Pause -- wait for user to confirm/reject
          }

          case 'action_executed':
            executedActions.push({ toolCallId: event.toolCallId, success: event.success, details: event.details });
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.role === 'assistant') {
                updated[updated.length - 1] = { ...last, executedActions: [...(last.executedActions ?? []), { toolCallId: event.toolCallId, success: event.success, details: event.details }] };
              }
              return updated;
            });
            // Notify bins changed when actions are executed
            notify(Events.BINS);
            break;

          case 'action_rejected':
            setMessages((prev) => {
              const updated = [...prev];
              // Find the message with this confirmation and update status
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].actionPreview?.confirmationId === event.confirmationId) {
                  updated[i] = { ...updated[i], actionPreview: { ...updated[i].actionPreview!, status: 'rejected' } };
                  break;
                }
              }
              return updated;
            });
            break;

          case 'done':
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.role === 'assistant') {
                updated[updated.length - 1] = { ...last, isStreaming: false };
              }
              return updated;
            });
            break;

          case 'error':
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.role === 'assistant') {
                updated[updated.length - 1] = { ...last, text: accumulatedText, isStreaming: false, error: event.message };
              }
              return updated;
            });
            break;
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const errorMessage = mapAiError(err, 'Failed to send message');
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant') {
          updated[updated.length - 1] = { ...last, isStreaming: false, error: errorMessage };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages, activeLocation?.id, isStreaming]);

  const confirmActions = useCallback(async (confirmationId: string, accepted: boolean) => {
    try {
      await apiFetch('/api/ai/chat/confirm', {
        method: 'POST',
        body: { confirmationId, accepted },
      });

      // Update the action preview status
      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].actionPreview?.confirmationId === confirmationId) {
            updated[i] = {
              ...updated[i],
              actionPreview: { ...updated[i].actionPreview!, status: accepted ? 'accepted' : 'rejected' },
            };
            break;
          }
        }
        return updated;
      });

      setPendingConfirmation(null);

      if (accepted) {
        // The SSE stream will resume and send action_executed events + continuation text
        // We need to continue reading the stream -- but the response already ended.
        // The server will resume after confirm, but we need to re-initiate streaming.
        // Actually, the confirm endpoint just resolves the promise server-side,
        // the original SSE connection is still open and will continue streaming.
        setIsStreaming(true);
      }
    } catch (err) {
      const errorMessage = mapAiError(err, 'Failed to confirm actions');
      setMessages((prev) => [...prev, { role: 'system', text: errorMessage }]);
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.role === 'assistant' && last.isStreaming) {
        updated[updated.length - 1] = { ...last, isStreaming: false };
      }
      return updated;
    });
  }, []);

  const clearChat = useCallback(() => {
    abort();
    setMessages([]);
    setPendingConfirmation(null);
  }, [abort]);

  return {
    messages,
    isStreaming,
    pendingConfirmation,
    sendMessage,
    confirmActions,
    abort,
    clearChat,
  };
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/features/ai/useChat.ts
git commit -m "feat(ai): add useChat hook for streaming chat state management"
```

---

### Task 6: Chat UI Components

Create the chat panel UI components that replace the existing CommandInput dialog.

**Files:**
- Create: `src/features/ai/ChatInput.tsx`
- Create: `src/features/ai/ChatBinCard.tsx`
- Create: `src/features/ai/ChatActionPreview.tsx`
- Create: `src/features/ai/ChatMessage.tsx`
- Create: `src/features/ai/ChatPanel.tsx`

**Step 1: Create ChatInput.tsx**

The input bar at the bottom of the chat panel. Textarea with send button, Cmd+Enter to submit, disabled while streaming.

```typescript
// src/features/ai/ChatInput.tsx
import { Send, Square } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
  disabled: boolean;
}

export function ChatInput({ onSend, onAbort, isStreaming, disabled }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const text = textareaRef.current?.value.trim();
    if (!text || disabled) return;
    onSend(text);
    if (textareaRef.current) textareaRef.current.value = '';
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-end gap-2 p-3 border-t border-[var(--border-primary)]">
      <textarea
        ref={textareaRef}
        placeholder="Ask about your inventory..."
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none rounded-[var(--radius-lg)] bg-[var(--bg-input)] border border-[var(--border-primary)] px-3 py-2 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] min-h-[40px] max-h-[120px]"
        onKeyDown={handleKeyDown}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = Math.min(target.scrollHeight, 120) + 'px';
        }}
      />
      {isStreaming ? (
        <button
          type="button"
          onClick={onAbort}
          className="shrink-0 rounded-full p-2 bg-[var(--bg-destructive)] text-[var(--text-on-destructive)] hover:opacity-90 transition-opacity"
          aria-label="Stop generating"
        >
          <Square className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled}
          className="shrink-0 rounded-full p-2 bg-[var(--bg-accent)] text-[var(--text-on-accent)] hover:opacity-90 transition-opacity disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
```

**Step 2: Create ChatBinCard.tsx**

Compact bin card for inline display in chat messages. Clickable to navigate to bin.

```typescript
// src/features/ai/ChatBinCard.tsx
import { useNavigate } from 'react-router-dom';

interface ChatBinCardProps {
  bin: {
    id: string;
    name: string;
    area_name?: string;
    items?: string[];
    tags?: string[];
    icon?: string;
    color?: string;
  };
  onClick?: () => void;
}

export function ChatBinCard({ bin, onClick }: ChatBinCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/bin/${bin.id}`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full text-left rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 hover:bg-[var(--bg-tertiary)] transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-[14px] text-[var(--text-primary)]">{bin.name}</span>
        {bin.area_name && (
          <span className="text-[12px] text-[var(--text-tertiary)]">{bin.area_name}</span>
        )}
      </div>
      {bin.items && bin.items.length > 0 && (
        <p className="text-[12px] text-[var(--text-secondary)] mt-1 line-clamp-1">
          {bin.items.slice(0, 5).join(', ')}{bin.items.length > 5 ? ` +${bin.items.length - 5} more` : ''}
        </p>
      )}
      {bin.tags && bin.tags.length > 0 && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {bin.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
```

**Step 3: Create ChatActionPreview.tsx**

Accept/reject widget for proposed mutations shown inline in chat.

```typescript
// src/features/ai/ChatActionPreview.tsx
import { Check, X } from 'lucide-react';
import type { ActionPreview } from './useChat';

interface ChatActionPreviewProps {
  actions: ActionPreview[];
  status: 'pending' | 'accepted' | 'rejected';
  onAccept: () => void;
  onReject: () => void;
}

export function ChatActionPreview({ actions, status, onAccept, onReject }: ChatActionPreviewProps) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 my-2">
      <p className="text-[13px] font-medium text-[var(--text-secondary)] mb-2">
        {status === 'pending' ? 'Proposed changes:' : status === 'accepted' ? 'Changes applied:' : 'Changes rejected:'}
      </p>
      <ul className="space-y-1.5">
        {actions.map((action) => (
          <li key={action.id} className="flex items-start gap-2 text-[13px] text-[var(--text-primary)]">
            <span className="shrink-0 mt-0.5 h-4 w-4 rounded border border-[var(--border-primary)] flex items-center justify-center">
              {status === 'accepted' && <Check className="h-3 w-3 text-[var(--text-success)]" />}
              {status === 'rejected' && <X className="h-3 w-3 text-[var(--text-destructive)]" />}
            </span>
            <span>{action.description}</span>
          </li>
        ))}
      </ul>
      {status === 'pending' && (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={onAccept}
            className="px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-md)] bg-[var(--bg-accent)] text-[var(--text-on-accent)] hover:opacity-90 transition-opacity"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={onReject}
            className="px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-md)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Create ChatMessage.tsx**

Renders a single message (user or assistant) with inline tool results and action previews.

```typescript
// src/features/ai/ChatMessage.tsx
import { AlertCircle } from 'lucide-react';
import type { ChatMessageContent } from './useChat';
import { ChatBinCard } from './ChatBinCard';
import { ChatActionPreview } from './ChatActionPreview';

interface ChatMessageProps {
  message: ChatMessageContent;
  onConfirmActions?: (confirmationId: string, accepted: boolean) => void;
  onClose?: () => void;
}

export function ChatMessage({ message, onConfirmActions, onClose }: ChatMessageProps) {
  if (message.role === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[12px] text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-3 py-1 rounded-full">
          {message.text}
        </span>
      </div>
    );
  }

  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] ${isUser ? 'bg-[var(--bg-accent)] text-[var(--text-on-accent)]' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'} rounded-[var(--radius-lg)] px-3.5 py-2.5`}>
        {/* Text content */}
        {message.text && (
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{message.text}</p>
        )}

        {/* Streaming cursor */}
        {message.isStreaming && !message.text && (
          <span className="inline-block w-2 h-4 bg-current opacity-60 animate-pulse" />
        )}

        {/* Tool results (bin cards) */}
        {message.toolResults?.map((tr) => {
          if (tr.name === 'search_bins' || tr.name === 'get_bin') {
            const result = tr.result as Record<string, unknown>;
            const bins = tr.name === 'search_bins'
              ? (result.bins as Array<Record<string, unknown>>) ?? []
              : result.error ? [] : [result];

            return (
              <div key={tr.toolCallId} className="mt-2 space-y-2">
                {bins.map((bin) => (
                  <ChatBinCard
                    key={bin.id as string}
                    bin={{
                      id: bin.id as string,
                      name: bin.name as string,
                      area_name: bin.area_name as string,
                      items: bin.items as string[],
                      tags: bin.tags as string[],
                      icon: bin.icon as string,
                      color: bin.color as string,
                    }}
                    onClick={onClose}
                  />
                ))}
              </div>
            );
          }

          if (tr.name === 'search_items') {
            const result = tr.result as { items?: Array<{ item_name: string; bin_name: string; area_name: string }> };
            if (!result.items?.length) return null;
            return (
              <div key={tr.toolCallId} className="mt-2 text-[13px]">
                {result.items.map((item, i) => (
                  <div key={i} className="py-1 border-b border-[var(--border-primary)] last:border-0">
                    <span className="font-medium">{item.item_name}</span>
                    <span className="text-[var(--text-tertiary)]"> in {item.bin_name}</span>
                    {item.area_name && <span className="text-[var(--text-tertiary)]"> ({item.area_name})</span>}
                  </div>
                ))}
              </div>
            );
          }

          return null;
        })}

        {/* Action preview */}
        {message.actionPreview && (
          <ChatActionPreview
            actions={message.actionPreview.actions}
            status={message.actionPreview.status}
            onAccept={() => onConfirmActions?.(message.actionPreview!.confirmationId, true)}
            onReject={() => onConfirmActions?.(message.actionPreview!.confirmationId, false)}
          />
        )}

        {/* Executed actions */}
        {message.executedActions && message.executedActions.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.executedActions.map((ea) => (
              <p key={ea.toolCallId} className={`text-[12px] ${ea.success ? 'text-[var(--text-success)]' : 'text-[var(--text-destructive)]'}`}>
                {ea.success ? '\u2713' : '\u2717'} {ea.details}
              </p>
            ))}
          </div>
        )}

        {/* Error */}
        {message.error && (
          <div className="mt-2 flex items-start gap-1.5 text-[var(--text-destructive)]">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p className="text-[12px]">{message.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 5: Create ChatPanel.tsx**

Main container that replaces CommandInput. Uses Dialog component, message list with auto-scroll, and ChatInput.

```typescript
// src/features/ai/ChatPanel.tsx
import { Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAiSettings } from './useAiSettings';
import { useChat } from './useChat';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatPanel({ open, onOpenChange }: ChatPanelProps) {
  const { settings } = useAiSettings();
  const { messages, isStreaming, confirmActions, sendMessage, abort, clearChat } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAiReady = settings !== null;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleClose = (v: boolean) => {
    if (!v) {
      abort();
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] sm:max-h-[85vh] flex flex-col !p-0 !pb-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--text-accent)]" />
            <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Assistant</h2>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors p-1"
              aria-label="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {!isAiReady ? (
          /* AI not configured */
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center">
            <Sparkles className="h-10 w-10 text-[var(--text-tertiary)] mb-3" />
            <p className="text-[15px] font-medium text-[var(--text-primary)] mb-1">Set up AI to get started</p>
            <p className="text-[13px] text-[var(--text-tertiary)]">Configure your AI provider in Settings to use the assistant.</p>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 min-h-[200px]">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Sparkles className="h-8 w-8 text-[var(--text-tertiary)] mb-2" />
                  <p className="text-[14px] text-[var(--text-tertiary)]">
                    Ask me anything about your inventory
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {['What bins have tools?', 'Create a bin for kitchen spices', 'Move batteries to Electronics'].map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => sendMessage(example)}
                        className="block text-[13px] text-[var(--text-accent)] hover:underline"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <ChatMessage
                    key={i}
                    message={msg}
                    onConfirmActions={confirmActions}
                    onClose={() => onOpenChange(false)}
                  />
                ))
              )}
            </div>

            {/* Input */}
            <ChatInput
              onSend={sendMessage}
              onAbort={abort}
              isStreaming={isStreaming}
              disabled={!isAiReady}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS (fix any import path issues)

**Step 7: Commit**

```bash
git add src/features/ai/ChatInput.tsx src/features/ai/ChatBinCard.tsx src/features/ai/ChatActionPreview.tsx src/features/ai/ChatMessage.tsx src/features/ai/ChatPanel.tsx
git commit -m "feat(ai): add chat UI components (panel, messages, actions, input)"
```

---

### Task 7: Wire Up ChatPanel to Trigger Points

Replace CommandInput with ChatPanel in DashboardPage and BinListDialogs.

**Files:**
- Modify: `src/features/dashboard/DashboardPage.tsx`
- Modify: `src/features/bins/BinListDialogs.tsx`
- Modify: `src/features/bins/BinListPage.tsx` (if needed for the import)

**Step 1: Update DashboardPage.tsx**

Change the lazy import from CommandInput to ChatPanel:

```typescript
// Before:
const CommandInput = lazy(() => import('@/features/ai/CommandInput').then((m) => ({ default: m.CommandInput })));

// After:
const ChatPanel = lazy(() => import('@/features/ai/ChatPanel').then((m) => ({ default: m.ChatPanel })));
```

Update the JSX that renders the component:

```typescript
// Before:
{commandOpen && <CommandInput open={commandOpen} onOpenChange={setCommandOpen} />}

// After:
{commandOpen && <ChatPanel open={commandOpen} onOpenChange={setCommandOpen} />}
```

**Step 2: Update BinListDialogs.tsx**

Same pattern -- change the lazy import and JSX:

```typescript
// Before:
const CommandInput = lazy(() => import('@/features/ai/CommandInput').then((m) => ({ default: m.CommandInput })));

// After:
const ChatPanel = lazy(() => import('@/features/ai/ChatPanel').then((m) => ({ default: m.ChatPanel })));
```

```typescript
// Before:
{commandOpen && <CommandInput open={commandOpen} onOpenChange={setCommandOpen} />}

// After:
{commandOpen && <ChatPanel open={commandOpen} onOpenChange={setCommandOpen} />}
```

**Step 3: Verify build**

Run: `npx tsc --noEmit && npx vite build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/dashboard/DashboardPage.tsx src/features/bins/BinListDialogs.tsx
git commit -m "feat(ai): wire ChatPanel to dashboard and bin list triggers"
```

---

### Task 8: Server Type Check and Lint

Run full verification to ensure server and client both pass.

**Step 1: Server type check**

Run: `cd server && npx tsc --noEmit`
Expected: PASS

**Step 2: Client type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Biome lint**

Run: `npx biome check .`
Expected: PASS (fix any issues)

**Step 4: Build**

Run: `npx vite build`
Expected: PASS

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve type and lint issues from chat implementation"
```

---

### Task 9: Manual Integration Test

Test the full flow end-to-end with a running server.

**Step 1: Start dev servers**

Run: `npm run dev:all`
Expected: Both Vite dev server and API server start

**Step 2: Test the chat flow**

1. Log in and navigate to a location with bins
2. Click the Sparkles button to open the chat panel
3. Type "What bins do I have?" and press Cmd+Enter
4. Verify: Response streams in with bin cards inline
5. Type "Create a bin called Test Bin with items: hammer, nails"
6. Verify: Action preview appears with Accept/Reject buttons
7. Click Accept
8. Verify: Action executes and AI confirms
9. Type "What's in Test Bin?"
10. Verify: AI responds with the bin contents

**Step 3: Test edge cases**

- Close dialog while streaming -- should abort cleanly
- Send message with no AI configured -- should show setup prompt
- Clear chat -- should reset all state
- Network error -- should show error inline

**Step 4: Commit any fixes from testing**

```bash
git add -A
git commit -m "fix: address issues found during integration testing"
```
