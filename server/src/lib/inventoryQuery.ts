import { AiAnalysisError, stripCodeFences } from './aiProviders.js';
import type { AiProviderConfig } from './aiProviders.js';

export interface QueryMatch {
  bin_id: string;
  name: string;
  area_name: string;
  items: string[];
  tags: string[];
  relevance: string;
}

export interface QueryResult {
  answer: string;
  matches: QueryMatch[];
}

export interface InventoryContext {
  bins: Array<{
    id: string;
    name: string;
    items: string[];
    tags: string[];
    area_name: string;
    notes: string;
    short_code: string;
  }>;
  areas: Array<{ id: string; name: string }>;
}

export const DEFAULT_QUERY_PROMPT = `You are an inventory search assistant. The user asks questions about what they have stored and where things are. Search through the provided inventory context and answer their question.

Rules:
- Answer in natural language, conversationally
- Reference specific bin names and areas when answering
- If items match partially, include them and note the partial match
- If nothing matches, say so clearly
- Always include the "matches" array with relevant bins, even if empty
- The "relevance" field should briefly explain why each bin matched (e.g., "contains batteries", "tagged as electronics")
- Sort matches by relevance (most relevant first)`;

function buildSystemPrompt(customPrompt?: string): string {
  const basePrompt = customPrompt || DEFAULT_QUERY_PROMPT;

  return `${basePrompt}

Respond with ONLY valid JSON, no markdown fences, no extra text. Format:
{"answer":"Your natural language answer here","matches":[{"bin_id":"uuid","name":"Bin Name","area_name":"Area","items":["relevant items"],"tags":["relevant tags"],"relevance":"why this matched"}]}

IMPORTANT: The "answer" and "matches" fields are both REQUIRED. If no bins match, return an empty matches array.`;
}

function buildUserMessage(question: string, context: InventoryContext): string {
  const binsContext = context.bins.map((b) => ({
    id: b.id,
    name: b.name,
    items: b.items,
    tags: b.tags,
    area_name: b.area_name,
    notes: b.notes.length > 200 ? b.notes.slice(0, 200) + '...' : b.notes,
    short_code: b.short_code,
  }));

  const areasContext = context.areas.map((a) => ({
    id: a.id,
    name: a.name,
  }));

  return `Question: ${question}

Inventory:
${JSON.stringify({ bins: binsContext, areas: areasContext })}`;
}

function validateQueryResult(raw: unknown, validBinIds: Set<string>): QueryResult {
  const obj = raw as Record<string, unknown>;
  const answer = typeof obj.answer === 'string' ? obj.answer : 'Unable to process query';

  const matches: QueryMatch[] = [];
  if (Array.isArray(obj.matches)) {
    for (const m of obj.matches) {
      if (!m || typeof m !== 'object') continue;
      const match = m as Record<string, unknown>;
      if (typeof match.bin_id !== 'string' || !validBinIds.has(match.bin_id)) continue;
      matches.push({
        bin_id: match.bin_id as string,
        name: typeof match.name === 'string' ? match.name : '',
        area_name: typeof match.area_name === 'string' ? match.area_name : '',
        items: Array.isArray(match.items) ? (match.items as unknown[]).filter((i): i is string => typeof i === 'string') : [],
        tags: Array.isArray(match.tags) ? (match.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [],
        relevance: typeof match.relevance === 'string' ? match.relevance : '',
      });
    }
  }

  return { answer, matches };
}

function mapHttpStatus(status: number): 'INVALID_KEY' | 'RATE_LIMITED' | 'MODEL_NOT_FOUND' | 'PROVIDER_ERROR' {
  if (status === 401 || status === 403) return 'INVALID_KEY';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 404) return 'MODEL_NOT_FOUND';
  return 'PROVIDER_ERROR';
}

async function callOpenAiCompatible(
  config: AiProviderConfig,
  question: string,
  context: InventoryContext,
  customPrompt?: string
): Promise<QueryResult> {
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
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          { role: 'system', content: buildSystemPrompt(customPrompt) },
          { role: 'user', content: buildUserMessage(question, context) },
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

  const validBinIds = new Set(context.bins.map((b) => b.id));
  try {
    const parsed = JSON.parse(stripCodeFences(content));
    return validateQueryResult(parsed, validBinIds);
  } catch {
    throw new AiAnalysisError('INVALID_RESPONSE', `Failed to parse response as JSON: ${content.slice(0, 200)}`);
  }
}

async function callAnthropic(
  config: AiProviderConfig,
  question: string,
  context: InventoryContext,
  customPrompt?: string
): Promise<QueryResult> {
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
        max_tokens: 2000,
        temperature: 0.3,
        system: buildSystemPrompt(customPrompt),
        messages: [
          { role: 'user', content: buildUserMessage(question, context) },
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

  const validBinIds = new Set(context.bins.map((b) => b.id));
  try {
    const parsed = JSON.parse(stripCodeFences(content));
    return validateQueryResult(parsed, validBinIds);
  } catch {
    throw new AiAnalysisError('INVALID_RESPONSE', `Failed to parse response as JSON: ${content.slice(0, 200)}`);
  }
}

export async function queryInventory(
  config: AiProviderConfig,
  question: string,
  context: InventoryContext,
  customPrompt?: string
): Promise<QueryResult> {
  if (config.provider === 'anthropic') {
    return callAnthropic(config, question, context, customPrompt);
  }
  return callOpenAiCompatible(config, question, context, customPrompt);
}
