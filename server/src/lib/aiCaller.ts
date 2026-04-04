import dns from 'node:dns';
import { promisify } from 'node:util';
import { generateText } from 'ai';
import { Agent } from 'undici';
import { config as appConfig } from './config.js';
import { createSdkModel } from './sdkProviderFactory.js';

const dnsResolve4 = promisify(dns.resolve4);
const dnsResolve6 = promisify(dns.resolve6);

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

/**
 * Validate an AI endpoint URL to prevent SSRF attacks.
 * Returns resolved IPs when DNS pinning is needed (cloud + custom host),
 * undefined when pinning is not needed (allowed host or self-hosted).
 */
export async function validateEndpointUrl(url: string, isDemoUser = false): Promise<string[] | undefined> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AiAnalysisError('NETWORK_ERROR', 'Invalid endpoint URL');
  }

  if (isDemoUser && !ALLOWED_AI_HOSTS.has(parsed.hostname)) {
    throw new AiAnalysisError('NETWORK_ERROR', 'Demo accounts cannot use custom AI endpoints');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new AiAnalysisError('NETWORK_ERROR', 'Endpoint URL must use http or https');
  }

  // Allow known AI provider hosts without DNS check
  if (ALLOWED_AI_HOSTS.has(parsed.hostname)) return undefined;

  // Self-hosted: skip DNS validation — admin needs LAN access for local AI (Ollama, etc.)
  if (appConfig.selfHosted) return undefined;

  // Cloud: resolve hostname, reject private IPs, return resolved IPs for DNS pinning
  try {
    const [ipv4s, ipv6s] = await Promise.all([
      dnsResolve4(parsed.hostname).catch(() => [] as string[]),
      dnsResolve6(parsed.hostname).catch(() => [] as string[]),
    ]);
    const allIps = [...ipv4s, ...ipv6s];
    if (allIps.length === 0) {
      throw new AiAnalysisError('NETWORK_ERROR', `Failed to resolve endpoint hostname: ${parsed.hostname}`);
    }
    for (const ip of allIps) {
      if (isPrivateIp(ip)) {
        throw new AiAnalysisError('NETWORK_ERROR', 'Endpoint URL must not resolve to a private or reserved IP address');
      }
    }
    return allIps;
  } catch (err) {
    if (err instanceof AiAnalysisError) throw err;
    throw new AiAnalysisError('NETWORK_ERROR', `Failed to resolve endpoint hostname: ${parsed.hostname}`);
  }
}

/** Create a fetch function that pins DNS to pre-validated IPs (prevents DNS rebinding). */
export function createPinnedFetch(resolvedIps: string[]): typeof globalThis.fetch {
  const ip = resolvedIps[0];
  const family = ip.includes(':') ? 6 : 4;
  const agent = new Agent({
    connect: {
      lookup: (
        _hostname: string,
        _options: unknown,
        cb: (err: Error | null, address: string, family: number) => void,
      ) => {
        cb(null, ip, family);
      },
    },
  });
  return ((input: unknown, init?: unknown) =>
    globalThis.fetch(input as Request, { ...(init as RequestInit), dispatcher: agent } as RequestInit)
  ) as typeof globalThis.fetch;
}

/** Safe client-facing messages keyed by AI error code (avoids leaking provider internals). */
export const SAFE_AI_MESSAGES: Partial<Record<AiErrorCode, string>> = {
  INVALID_KEY: 'Invalid API key — check your AI provider settings',
  RATE_LIMITED: 'Rate limited by provider — try again later',
  MODEL_NOT_FOUND: 'Model not found — check your AI provider settings',
  INVALID_RESPONSE: 'Provider returned an invalid response',
  NETWORK_ERROR: 'Cannot connect to AI endpoint — check your endpoint URL',
};

/** Convert an AiAnalysisError to a safe, client-facing message string. */
export function toSafeAiMessage(err: { code: AiErrorCode; message: string }): string {
  return SAFE_AI_MESSAGES[err.code] ?? err.message;
}

export class AiAnalysisError extends Error {
  code: AiErrorCode;
  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.name = 'AiAnalysisError';
    this.code = code;
  }
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

export async function testProviderConnection(config: AiProviderConfig, isDemoUser = false): Promise<void> {
  // SSRF protection: validate user-supplied endpoint URLs before making requests
  const resolvedIps = config.endpointUrl
    ? await validateEndpointUrl(config.endpointUrl, isDemoUser)
    : undefined;
  const pinnedFetch = resolvedIps ? createPinnedFetch(resolvedIps) : undefined;

  const model = createSdkModel(config, pinnedFetch);
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
