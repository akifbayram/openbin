import { callAiProvider } from './aiCaller.js';
import type { AiProviderConfig } from './aiCaller.js';
import { DEFAULT_COMMAND_PROMPT } from './defaultPrompts.js';

export interface BinSummary {
  id: string;
  name: string;
  items: Array<{ id: string; name: string }>;
  tags: string[];
  area_id: string | null;
  area_name: string;
  notes: string;
  icon: string;
  color: string;
  visibility: string;
  is_pinned: boolean;
  photo_count: number;
}

export interface AreaSummary {
  id: string;
  name: string;
}

export type CommandAction =
  | { type: 'add_items'; bin_id: string; bin_name: string; items: string[] }
  | { type: 'remove_items'; bin_id: string; bin_name: string; items: string[] }
  | { type: 'modify_item'; bin_id: string; bin_name: string; old_item: string; new_item: string }
  | { type: 'create_bin'; name: string; area_name?: string; tags?: string[]; items?: string[]; color?: string; icon?: string; notes?: string; card_style?: string }
  | { type: 'delete_bin'; bin_id: string; bin_name: string }
  | { type: 'add_tags'; bin_id: string; bin_name: string; tags: string[] }
  | { type: 'remove_tags'; bin_id: string; bin_name: string; tags: string[] }
  | { type: 'modify_tag'; bin_id: string; bin_name: string; old_tag: string; new_tag: string }
  | { type: 'set_area'; bin_id: string; bin_name: string; area_id: string | null; area_name: string }
  | { type: 'set_notes'; bin_id: string; bin_name: string; notes: string; mode: 'set' | 'append' | 'clear' }
  | { type: 'set_icon'; bin_id: string; bin_name: string; icon: string }
  | { type: 'set_color'; bin_id: string; bin_name: string; color: string }
  | { type: 'update_bin'; bin_id: string; bin_name: string; name?: string; notes?: string; tags?: string[]; area_name?: string; icon?: string; color?: string; card_style?: string; visibility?: 'location' | 'private' }
  | { type: 'restore_bin'; bin_id: string; bin_name: string }
  | { type: 'duplicate_bin'; bin_id: string; bin_name: string; new_name?: string }
  | { type: 'pin_bin'; bin_id: string; bin_name: string }
  | { type: 'unpin_bin'; bin_id: string; bin_name: string }
  | { type: 'rename_area'; area_id: string; area_name: string; new_name: string }
  | { type: 'delete_area'; area_id: string; area_name: string }
  | { type: 'set_tag_color'; tag: string; color: string }
  | { type: 'reorder_items'; bin_id: string; bin_name: string; item_ids: string[] };

export interface CommandRequest {
  text: string;
  context: {
    bins: BinSummary[];
    areas: AreaSummary[];
    trash_bins: Array<{ id: string; name: string }>;
    availableColors: string[];
    availableIcons: string[];
  };
}

export interface CommandResult {
  actions: CommandAction[];
  interpretation: string;
}

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
- update_bin: Update multiple bin fields at once. Fields: bin_id, bin_name, name?, notes?, tags?[], area_name?, icon?, color?, card_style?, visibility?
- restore_bin: Restore a bin from trash. Fields: bin_id, bin_name (use IDs from trash_bins, not bins)
- duplicate_bin: Duplicate a bin. Fields: bin_id, bin_name, new_name? (defaults to "Copy of <original>")
- pin_bin: Pin a bin for quick access. Fields: bin_id, bin_name
- unpin_bin: Unpin a bin. Fields: bin_id, bin_name
- rename_area: Rename an area. Fields: area_id, area_name, new_name
- delete_area: Delete an area (bins become unassigned). Fields: area_id, area_name
- set_tag_color: Set a tag's display color. Fields: tag, color
- reorder_items: Reorder items in a bin. Fields: bin_id, bin_name, item_ids[] (item IDs in desired order)

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
    visibility: b.visibility,
    is_pinned: b.is_pinned,
    photo_count: b.photo_count,
  }));

  const areasContext = request.context.areas.map((a) => ({
    id: a.id,
    name: a.name,
  }));

  const trashContext = request.context.trash_bins;

  return `Command: ${request.text}

Current inventory:
${JSON.stringify({ bins: binsContext, areas: areasContext, trash_bins: trashContext })}`;
}

const VALID_ACTION_TYPES = new Set([
  'add_items', 'remove_items', 'modify_item', 'create_bin', 'delete_bin',
  'add_tags', 'remove_tags', 'modify_tag', 'set_area', 'set_notes',
  'set_icon', 'set_color', 'update_bin', 'restore_bin',
  'duplicate_bin', 'pin_bin', 'unpin_bin', 'rename_area', 'delete_area',
  'set_tag_color', 'reorder_items',
]);

function validateCommandResult(raw: unknown, binIds: Set<string>, areaIds: Set<string>, trashBinIds: Set<string>): CommandResult {
  const obj = raw as Record<string, unknown>;
  const interpretation = typeof obj.interpretation === 'string' ? obj.interpretation : '';

  if (!Array.isArray(obj.actions)) {
    return { actions: [], interpretation: interpretation || 'Could not parse command' };
  }

  // Types that don't reference bins at all
  const noBinTypes = new Set(['create_bin', 'rename_area', 'delete_area', 'set_tag_color']);
  // Types that reference trash bins instead of active bins
  const trashTypes = new Set(['restore_bin']);

  const actions: CommandAction[] = [];
  for (const action of obj.actions) {
    if (!action || typeof action !== 'object') continue;
    const a = action as Record<string, unknown>;
    // Accept both "type" and "action" as the discriminator field
    const type = (a.type || a.action) as string;

    if (!VALID_ACTION_TYPES.has(type)) continue;

    // Validate bin_id references for actions that require existing bins
    if (!noBinTypes.has(type) && typeof a.bin_id === 'string') {
      if (trashTypes.has(type)) {
        if (!trashBinIds.has(a.bin_id)) continue; // Skip trash actions with invalid IDs
      } else {
        if (!binIds.has(a.bin_id)) continue; // Skip actions referencing non-existent bins
      }
    }

    // Validate area_id references for area actions
    if ((type === 'rename_area' || type === 'delete_area') && typeof a.area_id === 'string' && !areaIds.has(a.area_id)) {
      continue;
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
      case 'update_bin': {
        if (typeof a.bin_id !== 'string') continue;
        const vis = a.visibility as string | undefined;
        actions.push({
          type,
          bin_id: a.bin_id as string,
          bin_name: (a.bin_name as string) || '',
          name: typeof a.name === 'string' ? a.name.trim() : undefined,
          notes: typeof a.notes === 'string' ? a.notes : undefined,
          tags: Array.isArray(a.tags) ? (a.tags as unknown[]).filter((t): t is string => typeof t === 'string') : undefined,
          area_name: typeof a.area_name === 'string' ? a.area_name.trim() : undefined,
          icon: typeof a.icon === 'string' ? a.icon : undefined,
          color: typeof a.color === 'string' ? a.color : undefined,
          visibility: vis === 'location' || vis === 'private' ? vis : undefined,
        });
        break;
      }
      case 'restore_bin':
        if (typeof a.bin_id !== 'string') continue;
        actions.push({
          type,
          bin_id: a.bin_id as string,
          bin_name: (a.bin_name as string) || '',
        });
        break;
      case 'duplicate_bin':
        if (typeof a.bin_id !== 'string') continue;
        actions.push({
          type,
          bin_id: a.bin_id as string,
          bin_name: (a.bin_name as string) || '',
          new_name: typeof a.new_name === 'string' ? a.new_name.trim() : undefined,
        });
        break;
      case 'pin_bin':
      case 'unpin_bin':
        if (typeof a.bin_id !== 'string') continue;
        actions.push({
          type,
          bin_id: a.bin_id as string,
          bin_name: (a.bin_name as string) || '',
        });
        break;
      case 'rename_area':
        if (typeof a.area_id !== 'string' || typeof a.new_name !== 'string') continue;
        actions.push({
          type,
          area_id: a.area_id as string,
          area_name: (a.area_name as string) || '',
          new_name: (a.new_name as string).trim(),
        });
        break;
      case 'delete_area':
        if (typeof a.area_id !== 'string') continue;
        actions.push({
          type,
          area_id: a.area_id as string,
          area_name: (a.area_name as string) || '',
        });
        break;
      case 'set_tag_color':
        if (typeof a.tag !== 'string' || typeof a.color !== 'string') continue;
        actions.push({
          type,
          tag: (a.tag as string).trim(),
          color: (a.color as string).trim(),
        });
        break;
      case 'reorder_items':
        if (typeof a.bin_id !== 'string') continue;
        if (!Array.isArray(a.item_ids) || a.item_ids.length === 0) continue;
        actions.push({
          type,
          bin_id: a.bin_id as string,
          bin_name: (a.bin_name as string) || '',
          item_ids: (a.item_ids as unknown[]).filter((i): i is string => typeof i === 'string'),
        });
        break;
    }
  }

  return { actions, interpretation };
}

export interface CommandOverrides {
  temperature?: number | null;
  max_tokens?: number | null;
  top_p?: number | null;
  request_timeout?: number | null;
}

export async function parseCommand(
  config: AiProviderConfig,
  request: CommandRequest,
  customPrompt?: string,
  overrides?: CommandOverrides
): Promise<CommandResult> {
  const binIds = new Set(request.context.bins.map((b) => b.id));
  const areaIds = new Set(request.context.areas.map((a) => a.id));
  const trashBinIds = new Set(request.context.trash_bins.map((b) => b.id));

  return callAiProvider({
    config,
    systemPrompt: buildSystemPrompt(request, customPrompt),
    userContent: buildUserMessage(request),
    temperature: overrides?.temperature ?? 0.2,
    maxTokens: overrides?.max_tokens ?? 2000,
    topP: overrides?.top_p ?? undefined,
    timeoutMs: overrides?.request_timeout ? overrides.request_timeout * 1000 : undefined,
    validate: (raw) => validateCommandResult(raw, binIds, areaIds, trashBinIds),
  });
}
