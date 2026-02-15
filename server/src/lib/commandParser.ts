import { AiAnalysisError, stripCodeFences } from './aiProviders.js';
import type { AiProviderConfig } from './aiProviders.js';

export interface BinSummary {
  id: string;
  name: string;
  items: string[];
  tags: string[];
  area_id: string | null;
  area_name: string;
  notes: string;
  icon: string;
  color: string;
  short_code: string;
}

export interface AreaSummary {
  id: string;
  name: string;
}

export type CommandAction =
  | { type: 'add_items'; bin_id: string; bin_name: string; items: string[] }
  | { type: 'remove_items'; bin_id: string; bin_name: string; items: string[] }
  | { type: 'modify_item'; bin_id: string; bin_name: string; old_item: string; new_item: string }
  | { type: 'create_bin'; name: string; area_name?: string; tags?: string[]; items?: string[]; color?: string; icon?: string; notes?: string }
  | { type: 'delete_bin'; bin_id: string; bin_name: string }
  | { type: 'add_tags'; bin_id: string; bin_name: string; tags: string[] }
  | { type: 'remove_tags'; bin_id: string; bin_name: string; tags: string[] }
  | { type: 'modify_tag'; bin_id: string; bin_name: string; old_tag: string; new_tag: string }
  | { type: 'set_area'; bin_id: string; bin_name: string; area_id: string | null; area_name: string }
  | { type: 'set_notes'; bin_id: string; bin_name: string; notes: string; mode: 'set' | 'append' | 'clear' }
  | { type: 'set_icon'; bin_id: string; bin_name: string; icon: string }
  | { type: 'set_color'; bin_id: string; bin_name: string; color: string };

export interface CommandRequest {
  text: string;
  context: {
    bins: BinSummary[];
    areas: AreaSummary[];
    availableColors: string[];
    availableIcons: string[];
  };
}

export interface CommandResult {
  actions: CommandAction[];
  interpretation: string;
}

export const DEFAULT_COMMAND_PROMPT = `You are an inventory management assistant. The user will give you a natural language command about their storage bins. Parse it into one or more structured actions.

Rules:
- Use EXACT bin_id values from the provided inventory context. Never invent bin IDs.
- For item removal, use the exact item string from the bin's items list when possible.
- Fuzzy match bin names: "garden bin" should match a bin named "Garden Tools" or "Garden".
- Compound commands: "move X from A to B" = remove_items from A + add_items to B.
- "Rename item X to Y in bin Z" = modify_item with old_item=X, new_item=Y.
- For set_area, use the existing area_id if the area exists. Set area_id to null if a new area needs to be created.
- For set_color, use one of the available color keys.
- For set_icon, use one of the available icon names (PascalCase).
- For create_bin, only include fields that the user explicitly mentioned.
- Capitalize item names properly.
- If the command is ambiguous or references a bin that doesn't exist, return an empty actions array with an interpretation explaining the issue.`;

function buildSystemPrompt(request: CommandRequest, customPrompt?: string): string {
  const basePrompt = customPrompt || DEFAULT_COMMAND_PROMPT;

  return `${basePrompt}

Available action types:
- add_items: Add items to an existing bin. Fields: bin_id, bin_name, items[]
- remove_items: Remove items from an existing bin. Fields: bin_id, bin_name, items[]
- modify_item: Change an item's name in a bin. Fields: bin_id, bin_name, old_item, new_item
- create_bin: Create a new bin. Fields: name, area_name?, tags?[], items?[], color?, icon?, notes?
- delete_bin: Delete a bin. Fields: bin_id, bin_name
- add_tags: Add tags to a bin. Fields: bin_id, bin_name, tags[]
- remove_tags: Remove tags from a bin. Fields: bin_id, bin_name, tags[]
- modify_tag: Rename a tag on a bin. Fields: bin_id, bin_name, old_tag, new_tag
- set_area: Assign a bin to an area. Fields: bin_id, bin_name, area_id (null if new area), area_name
- set_notes: Set/append/clear bin notes. Fields: bin_id, bin_name, notes, mode ("set"|"append"|"clear")
- set_icon: Set a bin's icon. Fields: bin_id, bin_name, icon
- set_color: Set a bin's color. Fields: bin_id, bin_name, color

Available colors: ${request.context.availableColors.join(', ')}
Available icons: ${request.context.availableIcons.join(', ')}

IMPORTANT: Each action object MUST have a "type" field as a top-level property. All other fields are also top-level properties of the action object (NOT nested). The "interpretation" field is REQUIRED and must always be present.

Respond with ONLY valid JSON, no markdown fences, no extra text. Example response format:
{"actions":[{"type":"remove_items","bin_id":"abc","bin_name":"Tools","items":["Hammer"]},{"type":"add_items","bin_id":"def","bin_name":"Garage","items":["Hammer"]}],"interpretation":"Move hammer from Tools to Garage"}`;
}

function buildUserMessage(request: CommandRequest): string {
  const binsContext = request.context.bins.map((b) => ({
    id: b.id,
    name: b.name,
    items: b.items,
    tags: b.tags,
    area_id: b.area_id,
    area_name: b.area_name,
    notes: b.notes.length > 200 ? b.notes.slice(0, 200) + '...' : b.notes,
    icon: b.icon,
    color: b.color,
    short_code: b.short_code,
  }));

  const areasContext = request.context.areas.map((a) => ({
    id: a.id,
    name: a.name,
  }));

  return `Command: ${request.text}

Current inventory:
${JSON.stringify({ bins: binsContext, areas: areasContext })}`;
}

const VALID_ACTION_TYPES = new Set([
  'add_items', 'remove_items', 'modify_item', 'create_bin', 'delete_bin',
  'add_tags', 'remove_tags', 'modify_tag', 'set_area', 'set_notes',
  'set_icon', 'set_color',
]);

function validateCommandResult(raw: unknown, binIds: Set<string>): CommandResult {
  const obj = raw as Record<string, unknown>;
  const interpretation = typeof obj.interpretation === 'string' ? obj.interpretation : '';

  if (!Array.isArray(obj.actions)) {
    return { actions: [], interpretation: interpretation || 'Could not parse command' };
  }

  const actions: CommandAction[] = [];
  for (const action of obj.actions) {
    if (!action || typeof action !== 'object') continue;
    const a = action as Record<string, unknown>;
    // Accept both "type" and "action" as the discriminator field
    const type = (a.type || a.action) as string;

    if (!VALID_ACTION_TYPES.has(type)) continue;

    // Validate bin_id references for actions that require existing bins
    if (type !== 'create_bin' && typeof a.bin_id === 'string' && !binIds.has(a.bin_id)) {
      continue; // Skip actions referencing non-existent bins
    }

    // Type-specific validation
    switch (type) {
      case 'add_items':
      case 'remove_items':
        if (!Array.isArray(a.items) || a.items.length === 0) continue;
        actions.push({
          type,
          bin_id: a.bin_id as string,
          bin_name: (a.bin_name as string) || '',
          items: (a.items as unknown[]).filter((i): i is string => typeof i === 'string').map((i) => i.trim()).filter(Boolean),
        });
        break;
      case 'modify_item':
        if (typeof a.old_item !== 'string' || typeof a.new_item !== 'string') continue;
        actions.push({
          type,
          bin_id: a.bin_id as string,
          bin_name: (a.bin_name as string) || '',
          old_item: (a.old_item as string).trim(),
          new_item: (a.new_item as string).trim(),
        });
        break;
      case 'create_bin':
        if (typeof a.name !== 'string' || !a.name.trim()) continue;
        actions.push({
          type,
          name: (a.name as string).trim(),
          area_name: typeof a.area_name === 'string' ? a.area_name.trim() : undefined,
          tags: Array.isArray(a.tags) ? (a.tags as unknown[]).filter((t): t is string => typeof t === 'string') : undefined,
          items: Array.isArray(a.items) ? (a.items as unknown[]).filter((i): i is string => typeof i === 'string') : undefined,
          color: typeof a.color === 'string' ? a.color : undefined,
          icon: typeof a.icon === 'string' ? a.icon : undefined,
          notes: typeof a.notes === 'string' ? a.notes : undefined,
        });
        break;
      case 'delete_bin':
        actions.push({
          type,
          bin_id: a.bin_id as string,
          bin_name: (a.bin_name as string) || '',
        });
        break;
      case 'add_tags':
      case 'remove_tags':
        if (!Array.isArray(a.tags) || a.tags.length === 0) continue;
        actions.push({
          type,
          bin_id: a.bin_id as string,
          bin_name: (a.bin_name as string) || '',
          tags: (a.tags as unknown[]).filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean),
        });
        break;
      case 'modify_tag':
        if (typeof a.old_tag !== 'string' || typeof a.new_tag !== 'string') continue;
        actions.push({
          type,
          bin_id: a.bin_id as string,
          bin_name: (a.bin_name as string) || '',
          old_tag: (a.old_tag as string).trim(),
          new_tag: (a.new_tag as string).trim(),
        });
        break;
      case 'set_area':
        if (typeof a.area_name !== 'string') continue;
        actions.push({
          type,
          bin_id: a.bin_id as string,
          bin_name: (a.bin_name as string) || '',
          area_id: typeof a.area_id === 'string' ? a.area_id : null,
          area_name: (a.area_name as string).trim(),
        });
        break;
      case 'set_notes': {
        const mode = a.mode as string;
        if (!['set', 'append', 'clear'].includes(mode)) continue;
        actions.push({
          type,
          bin_id: a.bin_id as string,
          bin_name: (a.bin_name as string) || '',
          notes: typeof a.notes === 'string' ? a.notes : '',
          mode: mode as 'set' | 'append' | 'clear',
        });
        break;
      }
      case 'set_icon':
        if (typeof a.icon !== 'string') continue;
        actions.push({
          type,
          bin_id: a.bin_id as string,
          bin_name: (a.bin_name as string) || '',
          icon: a.icon as string,
        });
        break;
      case 'set_color':
        if (typeof a.color !== 'string') continue;
        actions.push({
          type,
          bin_id: a.bin_id as string,
          bin_name: (a.bin_name as string) || '',
          color: a.color as string,
        });
        break;
    }
  }

  return { actions, interpretation };
}

function mapHttpStatus(status: number): 'INVALID_KEY' | 'RATE_LIMITED' | 'MODEL_NOT_FOUND' | 'PROVIDER_ERROR' {
  if (status === 401 || status === 403) return 'INVALID_KEY';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 404) return 'MODEL_NOT_FOUND';
  return 'PROVIDER_ERROR';
}

async function callOpenAiCompatible(
  config: AiProviderConfig,
  request: CommandRequest,
  customPrompt?: string
): Promise<CommandResult> {
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
        temperature: 0.2,
        messages: [
          { role: 'system', content: buildSystemPrompt(request, customPrompt) },
          { role: 'user', content: buildUserMessage(request) },
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

  const binIds = new Set(request.context.bins.map((b) => b.id));
  try {
    const parsed = JSON.parse(stripCodeFences(content));
    return validateCommandResult(parsed, binIds);
  } catch {
    throw new AiAnalysisError('INVALID_RESPONSE', `Failed to parse response as JSON: ${content.slice(0, 200)}`);
  }
}

async function callAnthropic(
  config: AiProviderConfig,
  request: CommandRequest,
  customPrompt?: string
): Promise<CommandResult> {
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
        temperature: 0.2,
        system: buildSystemPrompt(request, customPrompt),
        messages: [
          { role: 'user', content: buildUserMessage(request) },
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

  const binIds = new Set(request.context.bins.map((b) => b.id));
  try {
    const parsed = JSON.parse(stripCodeFences(content));
    return validateCommandResult(parsed, binIds);
  } catch {
    throw new AiAnalysisError('INVALID_RESPONSE', `Failed to parse response as JSON: ${content.slice(0, 200)}`);
  }
}

async function callGemini(
  config: AiProviderConfig,
  request: CommandRequest,
  customPrompt?: string
): Promise<CommandResult> {
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
        systemInstruction: { parts: [{ text: buildSystemPrompt(request, customPrompt) }] },
        contents: [{ role: 'user', parts: [{ text: buildUserMessage(request) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
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

  const binIds = new Set(request.context.bins.map((b) => b.id));
  try {
    const parsed = JSON.parse(stripCodeFences(content));
    return validateCommandResult(parsed, binIds);
  } catch {
    throw new AiAnalysisError('INVALID_RESPONSE', `Failed to parse response as JSON: ${content.slice(0, 200)}`);
  }
}

export async function parseCommand(
  config: AiProviderConfig,
  request: CommandRequest,
  customPrompt?: string
): Promise<CommandResult> {
  if (config.provider === 'anthropic') {
    return callAnthropic(config, request, customPrompt);
  }
  if (config.provider === 'gemini') {
    return callGemini(config, request, customPrompt);
  }
  return callOpenAiCompatible(config, request, customPrompt);
}
