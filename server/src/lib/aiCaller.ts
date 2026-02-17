export type AiProviderType = 'openai' | 'anthropic' | 'gemini' | 'openai-compatible';

export interface AiProviderConfig {
  provider: AiProviderType;
  apiKey: string;
  model: string;
  endpointUrl: string | null;
}

type AiErrorCode = 'INVALID_KEY' | 'RATE_LIMITED' | 'MODEL_NOT_FOUND' | 'INVALID_RESPONSE' | 'NETWORK_ERROR' | 'PROVIDER_ERROR';

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

  return {
    model: req.config.model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    messages: [
      { role: 'system', content: req.systemPrompt },
      { role: 'user', content: userContent },
    ],
  };
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

  return {
    model: req.config.model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    system: req.systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  };
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

  return {
    systemInstruction: { parts: [{ text: req.systemPrompt }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: req.temperature, maxOutputTokens: req.maxTokens },
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

  let body: object;
  if (config.provider === 'anthropic') {
    body = buildAnthropicBody(request);
  } else if (config.provider === 'gemini') {
    body = buildGeminiBody(request);
  } else {
    body = buildOpenAiBody(request);
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
