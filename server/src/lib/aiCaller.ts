import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

export type AiProviderType = 'openai' | 'anthropic' | 'gemini' | 'openai-compatible';

export interface AiProviderConfig {
  provider: AiProviderType;
  apiKey: string;
  model: string;
  endpointUrl: string | null;
}

type AiErrorCode = 'INVALID_KEY' | 'RATE_LIMITED' | 'MODEL_NOT_FOUND' | 'INVALID_RESPONSE' | 'NETWORK_ERROR' | 'PROVIDER_ERROR';

/** Known AI provider hostnames that are always allowed. */
const ALLOWED_AI_HOSTS = new Set([
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
]);

/** Check if an IP address is in a private/reserved range (SSRF protection). */
function isPrivateIp(ip: string): boolean {
  // IPv4 private/reserved ranges
  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts.every((p) => p >= 0 && p <= 255)) {
    if (parts[0] === 10) return true;                                     // 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true;                // 192.168.0.0/16
    if (parts[0] === 127) return true;                                     // 127.0.0.0/8
    if (parts[0] === 169 && parts[1] === 254) return true;                // 169.254.0.0/16 (link-local/cloud metadata)
    if (parts[0] === 0) return true;                                       // 0.0.0.0/8
    return false;
  }
  // IPv6 private/reserved
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:')) return true;   // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
  if (lower.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 — check the embedded IPv4
    return isPrivateIp(lower.slice(7));
  }
  return false;
}

/** Validate an AI endpoint URL to prevent SSRF attacks. */
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

  // Allow known AI provider hosts without DNS check
  if (ALLOWED_AI_HOSTS.has(parsed.hostname)) return;

  // Resolve hostname and check for private IPs
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

export class AiAnalysisError extends Error {
  code: AiErrorCode;
  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.name = 'AiAnalysisError';
    this.code = code;
  }
}

export function stripCodeFences(text: string): string {
  let s = text.trim();
  if (s.startsWith('```json')) s = s.slice(7);
  else if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  return s.trim();
}

function mapHttpStatus(status: number): AiErrorCode {
  if (status === 401 || status === 403) return 'INVALID_KEY';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 404) return 'MODEL_NOT_FOUND';
  return 'PROVIDER_ERROR';
}

// -- Multimodal content types --

export interface ImageContent {
  type: 'image';
  base64: string;
  mimeType: string;
}

export interface TextContent {
  type: 'text';
  text: string;
}

export type MultimodalContent = ImageContent | TextContent;

export interface AiCallRequest<T> {
  config: AiProviderConfig;
  systemPrompt: string;
  userContent: string | MultimodalContent[];
  temperature: number;
  maxTokens: number;
  topP?: number;
  timeoutMs?: number;
  validate: (raw: unknown) => T;
}

// -- Per-provider body builders --

function buildOpenAiBody(req: AiCallRequest<unknown>): object {
  let userContent: unknown;
  if (typeof req.userContent === 'string') {
    userContent = req.userContent;
  } else {
    userContent = req.userContent.map((c) => {
      if (c.type === 'image') {
        return { type: 'image_url' as const, image_url: { url: `data:${c.mimeType};base64,${c.base64}` } };
      }
      return { type: 'text' as const, text: c.text };
    });
  }

  const body: Record<string, unknown> = {
    model: req.config.model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    messages: [
      { role: 'system', content: req.systemPrompt },
      { role: 'user', content: userContent },
    ],
  };
  if (req.topP != null) body.top_p = req.topP;
  return body;
}

function buildAnthropicBody(req: AiCallRequest<unknown>): object {
  let userContent: unknown;
  if (typeof req.userContent === 'string') {
    userContent = req.userContent;
  } else {
    userContent = req.userContent.map((c) => {
      if (c.type === 'image') {
        return { type: 'image' as const, source: { type: 'base64' as const, media_type: c.mimeType, data: c.base64 } };
      }
      return { type: 'text' as const, text: c.text };
    });
  }

  const body: Record<string, unknown> = {
    model: req.config.model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    system: req.systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  };
  if (req.topP != null) body.top_p = req.topP;
  return body;
}

function buildGeminiBody(req: AiCallRequest<unknown>): object {
  let parts: unknown[];
  if (typeof req.userContent === 'string') {
    parts = [{ text: req.userContent }];
  } else {
    parts = req.userContent.map((c) => {
      if (c.type === 'image') {
        return { inlineData: { mimeType: c.mimeType, data: c.base64 } };
      }
      return { text: c.text };
    });
  }

  const generationConfig: Record<string, unknown> = { temperature: req.temperature, maxOutputTokens: req.maxTokens };
  if (req.topP != null) generationConfig.topP = req.topP;
  return {
    systemInstruction: { parts: [{ text: req.systemPrompt }] },
    contents: [{ role: 'user', parts }],
    generationConfig,
  };
}

// -- Per-provider response extraction --

function extractTextContent(provider: AiProviderType, data: unknown): string | undefined {
  if (provider === 'anthropic') {
    const d = data as { content?: Array<{ type: string; text?: string }> };
    return d.content?.find((b) => b.type === 'text')?.text;
  }
  if (provider === 'gemini') {
    const d = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return d.candidates?.[0]?.content?.parts?.[0]?.text;
  }
  const d = data as { choices?: Array<{ message?: { content?: string } }> };
  return d.choices?.[0]?.message?.content;
}

// -- Per-provider URL + headers --

function getProviderRequest(config: AiProviderConfig, body: object): { url: string; headers: Record<string, string>; body: string } {
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
      url: `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify(body),
    };
  }
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

// -- Main entry points --

export async function callAiProvider<T>(request: AiCallRequest<T>): Promise<T> {
  const { config } = request;

  // SSRF protection: validate user-supplied endpoint URLs before making requests
  if (config.endpointUrl) {
    await validateEndpointUrl(config.endpointUrl);
  }

  let body: object;
  if (config.provider === 'anthropic') {
    body = buildAnthropicBody(request);
  } else if (config.provider === 'gemini') {
    body = buildGeminiBody(request);
  } else {
    body = buildOpenAiBody(request);
  }

  const req = getProviderRequest(config, body);

  const fetchOptions: RequestInit = { method: 'POST', headers: req.headers, body: req.body };
  if (request.timeoutMs) {
    fetchOptions.signal = AbortSignal.timeout(request.timeoutMs);
  }

  let res: Response;
  try {
    res = await fetch(req.url, fetchOptions);
  } catch (err) {
    const msg = (err as Error).name === 'TimeoutError'
      ? `Request timed out after ${Math.round((request.timeoutMs || 0) / 1000)}s`
      : `Failed to connect: ${(err as Error).message}`;
    throw new AiAnalysisError('NETWORK_ERROR', msg);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AiAnalysisError(mapHttpStatus(res.status), `Provider returned ${res.status}: ${text.slice(0, 200)}`);
  }

  const content = extractTextContent(config.provider, await res.json());
  if (!content) {
    throw new AiAnalysisError('INVALID_RESPONSE', 'No content in provider response');
  }

  try {
    const parsed = JSON.parse(stripCodeFences(content));
    return request.validate(parsed);
  } catch {
    throw new AiAnalysisError('INVALID_RESPONSE', `Failed to parse response as JSON: ${content.slice(0, 200)}`);
  }
}

export async function testProviderConnection(config: AiProviderConfig): Promise<void> {
  // SSRF protection: validate user-supplied endpoint URLs before making requests
  if (config.endpointUrl) {
    await validateEndpointUrl(config.endpointUrl);
  }

  let body: object;
  if (config.provider === 'anthropic') {
    body = { model: config.model, max_tokens: 10, messages: [{ role: 'user', content: 'Reply with OK' }] };
  } else if (config.provider === 'gemini') {
    body = { contents: [{ role: 'user', parts: [{ text: 'Reply with OK' }] }], generationConfig: { maxOutputTokens: 10 } };
  } else {
    body = { model: config.model, max_tokens: 10, messages: [{ role: 'user', content: 'Reply with OK' }] };
  }

  const req = getProviderRequest(config, body);

  let res: Response;
  try {
    res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
  } catch (err) {
    throw new AiAnalysisError('NETWORK_ERROR', `Failed to connect: ${(err as Error).message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AiAnalysisError(mapHttpStatus(res.status), `Provider returned ${res.status}: ${text.slice(0, 200)}`);
  }
}
