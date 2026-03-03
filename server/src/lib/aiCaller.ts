import dns from 'node:dns';
import { promisify } from 'node:util';
import { generateText } from 'ai';
import { createSdkModel } from './sdkProviderFactory.js';

const dnsLookup = promisify(dns.lookup);

export type AiProviderType = 'openai' | 'anthropic' | 'gemini' | 'openai-compatible';

export interface AiProviderConfig {
  provider: AiProviderType;
  apiKey: string;
  model: string;
  endpointUrl: string | null;
}

export type AiErrorCode = 'INVALID_KEY' | 'RATE_LIMITED' | 'MODEL_NOT_FOUND' | 'INVALID_RESPONSE' | 'NETWORK_ERROR' | 'PROVIDER_ERROR';

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
export async function validateEndpointUrl(url: string): Promise<void> {
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

/** Map Vercel AI SDK errors to AiAnalysisError. */
export function mapSdkError(err: unknown): AiAnalysisError {
  const e = err as { name?: string; status?: number; statusCode?: number; message?: string };
  const msg = e.message ?? 'Unknown provider error';
  const status = e.status ?? e.statusCode ?? 0;

  if (e.name === 'AI_APICallError' || e.name === 'APICallError') {
    if (status === 401 || status === 403) return new AiAnalysisError('INVALID_KEY', msg);
    if (status === 429) return new AiAnalysisError('RATE_LIMITED', msg);
    if (status === 404) return new AiAnalysisError('MODEL_NOT_FOUND', msg);
    return new AiAnalysisError('PROVIDER_ERROR', `Provider returned ${status}: ${msg.slice(0, 200)}`);
  }
  if (e.name === 'AI_LoadAPIKeyError') return new AiAnalysisError('INVALID_KEY', msg);
  if (e.name === 'AbortError' || e.name === 'TimeoutError' || msg.includes('timed out') || msg.includes('timeout')) {
    return new AiAnalysisError('NETWORK_ERROR', msg);
  }
  return new AiAnalysisError('PROVIDER_ERROR', msg.slice(0, 200));
}

/** Build SDK user message content from MultimodalContent or string. */
function buildUserContent(userContent: string | MultimodalContent[]): import('ai').UserContent {
  if (typeof userContent === 'string') {
    return userContent;
  }
  return userContent.map((c) => {
    if (c.type === 'image') {
      return {
        type: 'image' as const,
        image: Buffer.from(c.base64, 'base64'),
        mimeType: c.mimeType,
      };
    }
    return { type: 'text' as const, text: c.text };
  });
}

/**
 * Core AI call using Vercel AI SDK generateText().
 * Public interface identical to the original fetch()-based version.
 */
export async function callAiProvider<T>(request: AiCallRequest<T>): Promise<T> {
  const { config } = request;

  // SSRF protection: validate user-supplied endpoint URLs before making requests
  if (config.endpointUrl) {
    await validateEndpointUrl(config.endpointUrl);
  }

  const model = createSdkModel(config);

  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
      model,
      system: request.systemPrompt,
      messages: [{ role: 'user' as const, content: buildUserContent(request.userContent) }],
      maxOutputTokens: request.maxTokens,
      temperature: request.temperature,
      topP: request.topP,
      abortSignal: request.timeoutMs ? AbortSignal.timeout(request.timeoutMs) : undefined,
    });
  } catch (err) {
    throw mapSdkError(err);
  }

  const content = result.text;
  if (!content) {
    throw new AiAnalysisError('INVALID_RESPONSE', 'No content in provider response');
  }

  try {
    const parsed = JSON.parse(stripCodeFences(content));
    return request.validate(parsed);
  } catch (err) {
    if (err instanceof AiAnalysisError) throw err;
    throw new AiAnalysisError('INVALID_RESPONSE', `Failed to parse response as JSON: ${content.slice(0, 200)}`);
  }
}

export async function testProviderConnection(config: AiProviderConfig): Promise<void> {
  // SSRF protection: validate user-supplied endpoint URLs before making requests
  if (config.endpointUrl) {
    await validateEndpointUrl(config.endpointUrl);
  }

  const model = createSdkModel(config);
  try {
    await generateText({
      model,
      messages: [{ role: 'user' as const, content: 'Reply with OK' }],
      maxOutputTokens: 10,
    });
  } catch (err) {
    throw mapSdkError(err);
  }
}
