import type { AiProviderConfig, AiProviderType } from './aiCaller.js';
import { AiAnalysisError } from './aiCaller.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  tool_calls?: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;
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
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// SSRF protection — reuse the same validation from aiCaller.ts via import.
// aiCaller only exports the class and helpers, not validateEndpointUrl, so we
// replicate the minimal SSRF check here. This keeps aiCaller unmodified.
// ---------------------------------------------------------------------------

import dns from 'node:dns';
import { promisify } from 'node:util';

const dnsLookup = promisify(dns.lookup);

const ALLOWED_AI_HOSTS = new Set([
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
]);

function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts.every((p) => p >= 0 && p <= 255)) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:')) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('::ffff:')) {
    return isPrivateIp(lower.slice(7));
  }
  return false;
}

async function validateEndpointUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AiAnalysisError('NETWORK_ERROR', 'Invalid endpoint URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new AiAnalysisError('NETWORK_ERROR', 'Endpoint URL must use http or https');
  }

  if (ALLOWED_AI_HOSTS.has(parsed.hostname)) return;

  try {
    const { address } = await dnsLookup(parsed.hostname);
    if (isPrivateIp(address)) {
      throw new AiAnalysisError('NETWORK_ERROR', 'Endpoint URL must not resolve to a private or reserved IP address');
    }
  } catch (err) {
    if (err instanceof AiAnalysisError) throw err;
    throw new AiAnalysisError('NETWORK_ERROR', `Failed to resolve endpoint hostname: ${parsed.hostname}`);
  }
}

function mapHttpStatus(status: number): string {
  if (status === 401 || status === 403) return 'INVALID_KEY';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 404) return 'MODEL_NOT_FOUND';
  return 'PROVIDER_ERROR';
}

// ---------------------------------------------------------------------------
// Per-provider body builders (streaming variants)
// ---------------------------------------------------------------------------

function formatToolsOpenAi(tools: ToolDefinition[]): unknown[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

function formatToolsAnthropic(tools: ToolDefinition[]): unknown[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

function formatToolsGemini(tools: ToolDefinition[]): unknown[] {
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  ];
}

function buildOpenAiMessages(messages: ChatMessage[]): unknown[] {
  return messages.map((m) => {
    const msg: Record<string, unknown> = { role: m.role };
    if (m.content != null) msg.content = m.content;
    if (m.tool_calls) msg.tool_calls = m.tool_calls.map((tc) => ({ id: tc.id, type: 'function', function: tc.function }));
    if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
    return msg;
  });
}

function buildAnthropicMessages(messages: ChatMessage[]): { system: string | undefined; messages: unknown[] } {
  let system: string | undefined;
  const apiMessages: unknown[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      system = m.content;
      continue;
    }
    if (m.role === 'assistant') {
      const content: unknown[] = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          let parsedArgs: unknown;
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
            parsedArgs = {};
          }
          content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input: parsedArgs });
        }
      }
      apiMessages.push({ role: 'assistant', content: content.length === 1 && typeof content[0] === 'object' && (content[0] as Record<string, unknown>).type === 'text' ? m.content : content });
      continue;
    }
    if (m.role === 'tool') {
      apiMessages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content ?? '' }] });
      continue;
    }
    // user
    apiMessages.push({ role: 'user', content: m.content ?? '' });
  }

  return { system, messages: apiMessages };
}

function buildGeminiContents(messages: ChatMessage[]): { systemInstruction: unknown | undefined; contents: unknown[] } {
  let systemInstruction: unknown | undefined;
  const contents: unknown[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      systemInstruction = { parts: [{ text: m.content ?? '' }] };
      continue;
    }
    if (m.role === 'assistant') {
      const parts: unknown[] = [];
      if (m.content) parts.push({ text: m.content });
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          let parsedArgs: unknown;
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
            parsedArgs = {};
          }
          parts.push({ functionCall: { name: tc.function.name, args: parsedArgs } });
        }
      }
      contents.push({ role: 'model', parts });
      continue;
    }
    if (m.role === 'tool') {
      contents.push({
        role: 'function',
        parts: [{ functionResponse: { name: '', response: { result: m.content ?? '' } } }],
      });
      continue;
    }
    // user
    contents.push({ role: 'user', parts: [{ text: m.content ?? '' }] });
  }

  return { systemInstruction, contents };
}

function buildStreamingBody(request: StreamingCallRequest): { url: string; headers: Record<string, string>; body: string } {
  const { config, messages, tools, temperature, maxTokens, topP } = request;

  if (config.provider === 'anthropic') {
    const { system, messages: apiMessages } = buildAnthropicMessages(messages);
    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: maxTokens ?? 4096,
      stream: true,
      messages: apiMessages,
    };
    if (system) body.system = system;
    if (temperature != null) body.temperature = temperature;
    if (topP != null) body.top_p = topP;
    if (tools?.length) body.tools = formatToolsAnthropic(tools);

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
    const { systemInstruction, contents } = buildGeminiContents(messages);
    const generationConfig: Record<string, unknown> = {};
    if (temperature != null) generationConfig.temperature = temperature;
    if (maxTokens != null) generationConfig.maxOutputTokens = maxTokens;
    if (topP != null) generationConfig.topP = topP;

    const body: Record<string, unknown> = { contents, generationConfig };
    if (systemInstruction) body.systemInstruction = systemInstruction;
    if (tools?.length) body.tools = formatToolsGemini(tools);

    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse`,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify(body),
    };
  }

  // OpenAI / openai-compatible
  const body: Record<string, unknown> = {
    model: config.model,
    stream: true,
    messages: buildOpenAiMessages(messages),
  };
  if (maxTokens != null) body.max_tokens = maxTokens;
  if (temperature != null) body.temperature = temperature;
  if (topP != null) body.top_p = topP;
  if (tools?.length) body.tools = formatToolsOpenAi(tools);

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

// ---------------------------------------------------------------------------
// SSE line parser
// ---------------------------------------------------------------------------

async function* iterateSSELines(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        yield line;
      }
    }
    // Flush any remaining text
    if (buffer.length > 0) {
      yield buffer;
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Per-provider stream parsers
// ---------------------------------------------------------------------------

interface OpenAiToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
}

async function* parseOpenAiStream(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
  const toolCalls = new Map<number, OpenAiToolCallAccumulator>();

  for await (const line of iterateSSELines(body, signal)) {
    if (signal?.aborted) return;
    if (!line.startsWith('data: ')) continue;

    const payload = line.slice(6).trim();
    if (payload === '[DONE]') {
      // Emit any accumulated tool calls before done
      for (const tc of toolCalls.values()) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.arguments) as Record<string, unknown>;
        } catch { /* empty */ }
        yield { type: 'tool_call', id: tc.id, name: tc.name, arguments: parsedArgs };
      }
      toolCalls.clear();
      yield { type: 'done', finishReason: 'stop' };
      return;
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      continue;
    }

    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    if (!choices?.length) continue;

    const choice = choices[0];
    const delta = choice.delta as Record<string, unknown> | undefined;
    const finishReason = choice.finish_reason as string | null | undefined;

    if (delta) {
      // Text content
      if (typeof delta.content === 'string' && delta.content.length > 0) {
        yield { type: 'text_delta', delta: delta.content };
      }

      // Tool call chunks — OpenAI streams these incrementally
      const tcDeltas = delta.tool_calls as Array<Record<string, unknown>> | undefined;
      if (tcDeltas) {
        for (const tcDelta of tcDeltas) {
          const index = (tcDelta.index as number) ?? 0;
          const fn = tcDelta.function as Record<string, unknown> | undefined;

          if (!toolCalls.has(index)) {
            toolCalls.set(index, {
              id: (tcDelta.id as string) ?? '',
              name: fn?.name as string ?? '',
              arguments: '',
            });
          }
          const acc = toolCalls.get(index)!;
          if (tcDelta.id) acc.id = tcDelta.id as string;
          if (fn?.name) acc.name = fn.name as string;
          if (typeof fn?.arguments === 'string') acc.arguments += fn.arguments;
        }
      }
    }

    if (finishReason) {
      // Emit accumulated tool calls
      for (const tc of toolCalls.values()) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.arguments) as Record<string, unknown>;
        } catch { /* empty */ }
        yield { type: 'tool_call', id: tc.id, name: tc.name, arguments: parsedArgs };
      }
      toolCalls.clear();
      yield { type: 'done', finishReason };
      return;
    }
  }
}

async function* parseAnthropicStream(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
  // Anthropic uses event: / data: SSE format
  let currentEvent = '';
  const toolBlocks = new Map<number, { id: string; name: string; arguments: string }>();

  for await (const line of iterateSSELines(body, signal)) {
    if (signal?.aborted) return;

    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim();
      continue;
    }

    if (!line.startsWith('data: ')) continue;

    const payload = line.slice(6).trim();
    if (!payload) continue;

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      continue;
    }

    switch (currentEvent) {
      case 'content_block_start': {
        const block = data.content_block as Record<string, unknown> | undefined;
        const index = data.index as number ?? 0;
        if (block?.type === 'tool_use') {
          toolBlocks.set(index, {
            id: block.id as string ?? '',
            name: block.name as string ?? '',
            arguments: '',
          });
        }
        break;
      }
      case 'content_block_delta': {
        const delta = data.delta as Record<string, unknown> | undefined;
        const index = data.index as number ?? 0;
        if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
          yield { type: 'text_delta', delta: delta.text };
        }
        if (delta?.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
          const acc = toolBlocks.get(index);
          if (acc) acc.arguments += delta.partial_json;
        }
        break;
      }
      case 'content_block_stop': {
        const index = data.index as number ?? 0;
        const acc = toolBlocks.get(index);
        if (acc) {
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(acc.arguments) as Record<string, unknown>;
          } catch { /* empty */ }
          yield { type: 'tool_call', id: acc.id, name: acc.name, arguments: parsedArgs };
          toolBlocks.delete(index);
        }
        break;
      }
      case 'message_delta': {
        const delta = data.delta as Record<string, unknown> | undefined;
        if (delta?.stop_reason) {
          yield { type: 'done', finishReason: delta.stop_reason as string };
          return;
        }
        break;
      }
      case 'message_stop': {
        yield { type: 'done', finishReason: 'end_turn' };
        return;
      }
      case 'error': {
        const error = data.error as Record<string, unknown> | undefined;
        yield {
          type: 'error',
          message: (error?.message as string) ?? 'Unknown Anthropic error',
          code: 'PROVIDER_ERROR',
        };
        return;
      }
      default:
        // ping, message_start, etc. — ignore
        break;
    }
  }
}

async function* parseGeminiStream(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
  for await (const line of iterateSSELines(body, signal)) {
    if (signal?.aborted) return;
    if (!line.startsWith('data: ')) continue;

    const payload = line.slice(6).trim();
    if (!payload) continue;

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      continue;
    }

    const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
    if (!candidates?.length) continue;

    const candidate = candidates[0];
    const content = candidate.content as Record<string, unknown> | undefined;
    const parts = content?.parts as Array<Record<string, unknown>> | undefined;

    if (parts) {
      for (const part of parts) {
        if (typeof part.text === 'string' && part.text.length > 0) {
          yield { type: 'text_delta', delta: part.text };
        }
        const functionCall = part.functionCall as Record<string, unknown> | undefined;
        if (functionCall) {
          const args = (functionCall.args ?? {}) as Record<string, unknown>;
          yield {
            type: 'tool_call',
            id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: functionCall.name as string ?? '',
            arguments: args,
          };
        }
      }
    }

    const finishReason = candidate.finishReason as string | undefined;
    if (finishReason) {
      yield { type: 'done', finishReason };
      return;
    }
  }

  // If we exit the loop without an explicit done, emit one
  yield { type: 'done', finishReason: 'stop' };
}

// ---------------------------------------------------------------------------
// Provider-specific parser dispatch
// ---------------------------------------------------------------------------

function getStreamParser(provider: AiProviderType): (body: ReadableStream<Uint8Array>, signal?: AbortSignal) => AsyncGenerator<StreamEvent> {
  switch (provider) {
    case 'anthropic':
      return parseAnthropicStream;
    case 'gemini':
      return parseGeminiStream;
    case 'openai':
    case 'openai-compatible':
      return parseOpenAiStream;
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function* callAiProviderStreaming(request: StreamingCallRequest): AsyncGenerator<StreamEvent> {
  const { config, signal } = request;

  // SSRF protection: validate user-supplied endpoint URLs before making requests
  if (config.endpointUrl) {
    await validateEndpointUrl(config.endpointUrl);
  }

  const req = buildStreamingBody(request);

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers: req.headers,
    body: req.body,
  };

  // Combine external abort signal with timeout if provided
  if (request.timeoutMs || signal) {
    const controller = new AbortController();

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (request.timeoutMs) {
      timeoutId = setTimeout(() => controller.abort(new Error('timeout')), request.timeoutMs);
    }

    if (signal) {
      if (signal.aborted) {
        controller.abort(signal.reason);
      } else {
        signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
      }
    }

    fetchOptions.signal = controller.signal;

    try {
      yield* doStreamingFetch(config, req.url, fetchOptions, signal);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  } else {
    yield* doStreamingFetch(config, req.url, fetchOptions, signal);
  }
}

async function* doStreamingFetch(
  config: AiProviderConfig,
  url: string,
  fetchOptions: RequestInit,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  let res: Response;
  try {
    res = await fetch(url, fetchOptions);
  } catch (err) {
    const error = err as Error;
    if (error.name === 'AbortError' || error.message === 'timeout') {
      yield { type: 'error', message: 'Request aborted or timed out', code: 'NETWORK_ERROR' };
      return;
    }
    yield { type: 'error', message: `Failed to connect: ${error.message}`, code: 'NETWORK_ERROR' };
    return;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    yield {
      type: 'error',
      message: `Provider returned ${res.status}: ${text.slice(0, 200)}`,
      code: mapHttpStatus(res.status),
    };
    return;
  }

  if (!res.body) {
    yield { type: 'error', message: 'No response body for streaming', code: 'PROVIDER_ERROR' };
    return;
  }

  const parser = getStreamParser(config.provider);
  yield* parser(res.body, signal);
}
