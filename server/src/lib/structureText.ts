import { AiAnalysisError, stripCodeFences } from './aiProviders.js';
import type { AiProviderConfig } from './aiProviders.js';

export interface StructureTextRequest {
  text: string;
  mode: 'items';
  context?: {
    binName?: string;
    existingItems?: string[];
  };
}

export interface StructureTextResult {
  items: string[];
}

const ITEMS_SYSTEM_PROMPT = `You are an inventory item extractor. The user will dictate or type a description of items in a storage bin. Your job is to parse this into a clean, structured list of individual items.

Rules:
- Return a JSON object with a single "items" field containing an array of strings
- Each entry should be one distinct item type
- Include quantity in parentheses when more than one: "Socks (x3)", "AA batteries (x8)"
- Normalize spoken numbers: "three pairs of socks" → "Socks (x3)"
- Be specific: "Phillips screwdriver" not just "screwdriver"
- Capitalize the first letter of each item
- Remove filler words (um, uh, like, basically, etc.)
- Remove conversational phrases ("I think there's", "and also", "let me see")
- Deduplicate items — if the same item is mentioned multiple times, combine quantities
- Order from first mentioned to last mentioned
- Do NOT include the bin or container itself

Respond with ONLY valid JSON, no markdown fences, no extra text. Example:
{"items":["Winter jacket","Socks (x3)","Old t-shirts (x5)","Scarf","Wool gloves (x2)"]}`;

function buildPrompt(request: StructureTextRequest, customPrompt?: string): string {
  let prompt = customPrompt || ITEMS_SYSTEM_PROMPT;

  if (request.context?.binName) {
    prompt += `\n\nBin name: "${request.context.binName}" — use this for context about what type of items to expect.`;
  }

  if (request.context?.existingItems && request.context.existingItems.length > 0) {
    prompt += `\n\nExisting items already in this bin: ${JSON.stringify(request.context.existingItems)}. Do NOT include these in your response — only return NEW items from the dictation.`;
  }

  return prompt;
}

function mapHttpStatus(status: number): 'INVALID_KEY' | 'RATE_LIMITED' | 'MODEL_NOT_FOUND' | 'PROVIDER_ERROR' {
  if (status === 401 || status === 403) return 'INVALID_KEY';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 404) return 'MODEL_NOT_FOUND';
  return 'PROVIDER_ERROR';
}

function validateItems(raw: unknown): StructureTextResult {
  const obj = raw as Record<string, unknown>;
  let items: string[] = [];
  if (Array.isArray(obj.items)) {
    items = obj.items
      .filter((i): i is string => typeof i === 'string')
      .map((i) => i.trim())
      .filter(Boolean)
      .slice(0, 500);
  }
  return { items };
}

async function callOpenAiCompatible(
  config: AiProviderConfig,
  request: StructureTextRequest,
  customPrompt?: string
): Promise<StructureTextResult> {
  const baseUrl = config.endpointUrl || 'https://api.openai.com/v1';
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 800,
        temperature: 0.2,
        messages: [
          { role: 'system', content: buildPrompt(request, customPrompt) },
          { role: 'user', content: request.text },
        ],
      }),
    });
  } catch (err) {
    throw new AiAnalysisError('NETWORK_ERROR', `Failed to connect: ${(err as Error).message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new AiAnalysisError(mapHttpStatus(res.status), `Provider returned ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiAnalysisError('INVALID_RESPONSE', 'No content in provider response');
  }

  try {
    const parsed = JSON.parse(stripCodeFences(content));
    return validateItems(parsed);
  } catch {
    throw new AiAnalysisError('INVALID_RESPONSE', `Failed to parse response as JSON: ${content.slice(0, 200)}`);
  }
}

async function callAnthropic(
  config: AiProviderConfig,
  request: StructureTextRequest,
  customPrompt?: string
): Promise<StructureTextResult> {
  const baseUrl = config.endpointUrl || 'https://api.anthropic.com';
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/messages`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 800,
        temperature: 0.2,
        system: buildPrompt(request, customPrompt),
        messages: [
          { role: 'user', content: request.text },
        ],
      }),
    });
  } catch (err) {
    throw new AiAnalysisError('NETWORK_ERROR', `Failed to connect: ${(err as Error).message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new AiAnalysisError(mapHttpStatus(res.status), `Provider returned ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
  const textBlock = data.content?.find((b) => b.type === 'text');
  const content = textBlock?.text;
  if (!content) {
    throw new AiAnalysisError('INVALID_RESPONSE', 'No text content in Anthropic response');
  }

  try {
    const parsed = JSON.parse(stripCodeFences(content));
    return validateItems(parsed);
  } catch {
    throw new AiAnalysisError('INVALID_RESPONSE', `Failed to parse response as JSON: ${content.slice(0, 200)}`);
  }
}

async function callGemini(
  config: AiProviderConfig,
  request: StructureTextRequest,
  customPrompt?: string
): Promise<StructureTextResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildPrompt(request, customPrompt) }] },
        contents: [{ role: 'user', parts: [{ text: request.text }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
      }),
    });
  } catch (err) {
    throw new AiAnalysisError('NETWORK_ERROR', `Failed to connect: ${(err as Error).message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new AiAnalysisError(mapHttpStatus(res.status), `Provider returned ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new AiAnalysisError('INVALID_RESPONSE', 'No text content in Gemini response');
  }

  try {
    const parsed = JSON.parse(stripCodeFences(content));
    return validateItems(parsed);
  } catch {
    throw new AiAnalysisError('INVALID_RESPONSE', `Failed to parse response as JSON: ${content.slice(0, 200)}`);
  }
}

export async function structureText(
  config: AiProviderConfig,
  request: StructureTextRequest,
  customPrompt?: string
): Promise<StructureTextResult> {
  if (config.provider === 'anthropic') {
    return callAnthropic(config, request, customPrompt);
  }
  if (config.provider === 'gemini') {
    return callGemini(config, request, customPrompt);
  }
  return callOpenAiCompatible(config, request, customPrompt);
}
