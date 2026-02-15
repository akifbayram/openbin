export const DEFAULT_AI_PROMPT = `You are an inventory cataloging assistant. You analyze photos of physical storage bins and containers to create searchable inventory records.

You may receive 1–5 photos of the same bin from different angles. Cross-reference all images to build one unified inventory entry. Do not duplicate items visible in multiple photos.

Return a JSON object with exactly these four fields:

"name" — A concise title for the bin's contents (2–5 words, title case). Describe WHAT is stored, not the container. Good: "Assorted Screwdrivers", "Holiday Lights", "USB Cables". Bad: "Red Bin", "Stuff", "Miscellaneous Items".

"items" — A flat array of distinct items. Rules:
- One entry per distinct item type; include quantity in parentheses when more than one: "Phillips screwdriver (x3)"
- Be specific: "adjustable crescent wrench" not just "wrench"; "AA batteries (x8)" not "batteries"
- Include brand names, model numbers, or sizes when clearly readable on labels
- For sealed/packaged items, describe the product, not the packaging
- Omit the bin or container itself
- Order from most prominent to least prominent

"tags" — 2–5 lowercase single-word category labels for filtering. Rules:
- Each tag MUST be a single word. Never use multi-word tags. Bad: "office supplies", "hand tools", "craft materials". Good: "office", "tools", "craft"
- Use plural nouns: "tools", "cables", "batteries"
- Start broad, then add 1–2 specific subcategories: ["tools", "screwdrivers"] or ["electronics", "cables", "usb"]
- Prefer standard terms: tools, electronics, hardware, office, kitchen, craft, seasonal, automotive, outdoor, clothing, toys, cleaning, medical, plumbing, electrical, cables, batteries, fasteners, adhesives, paint, garden, sports, storage, lighting, sewing

"notes" — One sentence on organization or condition. Mention: how contents are arranged (sorted by size, loosely mixed, in original packaging), condition (new, used, worn), or any notable labels/markings. Use empty string "" if nothing notable.

Respond with ONLY valid JSON, no markdown fences, no extra text. Example:
{"name":"Assorted Screwdrivers","items":["Phillips screwdriver (x3)","flathead screwdriver (x2)","precision screwdriver set in case","magnetic bit holder"],"tags":["tools","screwdrivers","hardware"],"notes":"Neatly organized with larger screwdrivers on the left and precision set in original case."}`;

function buildSystemPrompt(existingTags?: string[], customPrompt?: string | null): string {
  const basePrompt = customPrompt || DEFAULT_AI_PROMPT;

  if (!existingTags || existingTags.length === 0) {
    return basePrompt.replace(/\{available_tags\}/g, '');
  }

  const tagBlock = `EXISTING TAGS in this inventory: [${existingTags.join(', ')}]
When a relevant existing tag fits the bin's contents, reuse it instead of creating a new synonym. Only create new tags when no existing tag is appropriate.`;

  if (basePrompt.includes('{available_tags}')) {
    return basePrompt.replace(/\{available_tags\}/g, tagBlock);
  }

  return `${basePrompt}\n\n${tagBlock}`;
}

export type AiProviderType = 'openai' | 'anthropic' | 'gemini' | 'openai-compatible';

export interface AiProviderConfig {
  provider: AiProviderType;
  apiKey: string;
  model: string;
  endpointUrl: string | null;
}

export interface AiSuggestionsResult {
  name: string;
  items: string[];
  tags: string[];
  notes: string;
}

export interface ImageInput {
  base64: string;
  mimeType: string;
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

function mapHttpStatus(status: number): AiErrorCode {
  if (status === 401 || status === 403) return 'INVALID_KEY';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 404) return 'MODEL_NOT_FOUND';
  return 'PROVIDER_ERROR';
}

export function stripCodeFences(text: string): string {
  let s = text.trim();
  if (s.startsWith('```json')) s = s.slice(7);
  else if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  return s.trim();
}

function validateSuggestions(raw: unknown): AiSuggestionsResult {
  const obj = raw as Record<string, unknown>;

  let name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (name.length > 255) name = name.slice(0, 255);

  let items: string[] = [];
  if (Array.isArray(obj.items)) {
    items = obj.items
      .filter((i): i is string => typeof i === 'string')
      .map((i) => i.trim())
      .filter(Boolean)
      .slice(0, 100);
  }

  let tags: string[] = [];
  if (Array.isArray(obj.tags)) {
    tags = obj.tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
  }

  let notes = typeof obj.notes === 'string' ? obj.notes.trim() : '';
  if (notes.length > 2000) notes = notes.slice(0, 2000);

  return { name, items, tags, notes };
}

async function callOpenAiCompatible(
  config: AiProviderConfig,
  images: ImageInput[],
  existingTags?: string[],
  customPrompt?: string | null
): Promise<AiSuggestionsResult> {
  const baseUrl = config.endpointUrl || 'https://api.openai.com/v1';
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const imageBlocks = images.map((img) => ({
    type: 'image_url' as const,
    image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
  }));

  const userText = images.length > 1
    ? `Catalog the contents of this storage bin. ${images.length} photos attached showing different angles of the same bin.`
    : 'Catalog the contents of this storage bin.';

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
        max_tokens: images.length > 1 ? 2000 : 1500,
        temperature: 0.3,
        messages: [
          { role: 'system', content: buildSystemPrompt(existingTags, customPrompt) },
          {
            role: 'user',
            content: [
              ...imageBlocks,
              { type: 'text', text: userText },
            ],
          },
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
    return validateSuggestions(parsed);
  } catch {
    throw new AiAnalysisError('INVALID_RESPONSE', `Failed to parse response as JSON: ${content.slice(0, 200)}`);
  }
}

async function callAnthropic(
  config: AiProviderConfig,
  images: ImageInput[],
  existingTags?: string[],
  customPrompt?: string | null
): Promise<AiSuggestionsResult> {
  const baseUrl = config.endpointUrl || 'https://api.anthropic.com';
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/messages`;

  const imageBlocks = images.map((img) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: img.mimeType,
      data: img.base64,
    },
  }));

  const userText = images.length > 1
    ? `Catalog the contents of this storage bin. ${images.length} photos attached showing different angles of the same bin.`
    : 'Catalog the contents of this storage bin.';

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
        max_tokens: images.length > 1 ? 2000 : 1500,
        temperature: 0.3,
        system: buildSystemPrompt(existingTags, customPrompt),
        messages: [
          {
            role: 'user',
            content: [
              ...imageBlocks,
              { type: 'text', text: userText },
            ],
          },
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
    return validateSuggestions(parsed);
  } catch {
    throw new AiAnalysisError('INVALID_RESPONSE', `Failed to parse response as JSON: ${content.slice(0, 200)}`);
  }
}

async function callGemini(
  config: AiProviderConfig,
  images: ImageInput[],
  existingTags?: string[],
  customPrompt?: string | null
): Promise<AiSuggestionsResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;

  const imageParts = images.map((img) => ({
    inlineData: { mimeType: img.mimeType, data: img.base64 },
  }));

  const userText = images.length > 1
    ? `Catalog the contents of this storage bin. ${images.length} photos attached showing different angles of the same bin.`
    : 'Catalog the contents of this storage bin.';

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(existingTags, customPrompt) }] },
        contents: [{ role: 'user', parts: [...imageParts, { text: userText }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: images.length > 1 ? 2000 : 1500,
        },
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
    return validateSuggestions(parsed);
  } catch {
    throw new AiAnalysisError('INVALID_RESPONSE', `Failed to parse response as JSON: ${content.slice(0, 200)}`);
  }
}

export async function analyzeImages(
  config: AiProviderConfig,
  images: ImageInput[],
  existingTags?: string[],
  customPrompt?: string | null
): Promise<AiSuggestionsResult> {
  if (config.provider === 'anthropic') {
    return callAnthropic(config, images, existingTags, customPrompt);
  }
  if (config.provider === 'gemini') {
    return callGemini(config, images, existingTags, customPrompt);
  }
  return callOpenAiCompatible(config, images, existingTags, customPrompt);
}

export async function analyzeImage(
  config: AiProviderConfig,
  imageBase64: string,
  mimeType: string,
  existingTags?: string[],
  customPrompt?: string | null
): Promise<AiSuggestionsResult> {
  return analyzeImages(config, [{ base64: imageBase64, mimeType }], existingTags, customPrompt);
}

export async function testConnection(config: AiProviderConfig): Promise<void> {
  if (config.provider === 'anthropic') {
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
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Reply with OK' }],
        }),
      });
    } catch (err) {
      throw new AiAnalysisError('NETWORK_ERROR', `Failed to connect: ${(err as Error).message}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AiAnalysisError(mapHttpStatus(res.status), `Provider returned ${res.status}: ${body.slice(0, 200)}`);
    }
  } else if (config.provider === 'gemini') {
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
          contents: [{ role: 'user', parts: [{ text: 'Reply with OK' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });
    } catch (err) {
      throw new AiAnalysisError('NETWORK_ERROR', `Failed to connect: ${(err as Error).message}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AiAnalysisError(mapHttpStatus(res.status), `Provider returned ${res.status}: ${body.slice(0, 200)}`);
    }
  } else {
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
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Reply with OK' }],
        }),
      });
    } catch (err) {
      throw new AiAnalysisError('NETWORK_ERROR', `Failed to connect: ${(err as Error).message}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AiAnalysisError(mapHttpStatus(res.status), `Provider returned ${res.status}: ${body.slice(0, 200)}`);
    }
  }
}
