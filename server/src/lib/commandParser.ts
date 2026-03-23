import { HARDENING_INSTRUCTION, resolvePrompt, sanitizeForPrompt } from './aiSanitize.js';
import { DEFAULT_COMMAND_PROMPT } from './defaultPrompts.js';

export interface BinSummary {
  id: string;
  name: string;
  items: Array<{ id: string; name: string; quantity: number | null }>;
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
  | { type: 'add_items'; bin_id: string; bin_name: string; items: (string | { name: string; quantity?: number })[] }
  | { type: 'remove_items'; bin_id: string; bin_name: string; items: string[] }
  | { type: 'modify_item'; bin_id: string; bin_name: string; old_item: string; new_item: string }
  | { type: 'create_bin'; name: string; area_name?: string; tags?: string[]; items?: (string | { name: string; quantity?: number })[]; color?: string; icon?: string; notes?: string; card_style?: string; custom_fields?: Record<string, string> }
  | { type: 'delete_bin'; bin_id: string; bin_name: string }
  | { type: 'add_tags'; bin_id: string; bin_name: string; tags: string[] }
  | { type: 'remove_tags'; bin_id: string; bin_name: string; tags: string[] }
  | { type: 'modify_tag'; bin_id: string; bin_name: string; old_tag: string; new_tag: string }
  | { type: 'set_area'; bin_id: string; bin_name: string; area_id: string | null; area_name: string }
  | { type: 'set_notes'; bin_id: string; bin_name: string; notes: string; mode: 'set' | 'append' | 'clear' }
  | { type: 'set_icon'; bin_id: string; bin_name: string; icon: string }
  | { type: 'set_color'; bin_id: string; bin_name: string; color: string }
  | { type: 'update_bin'; bin_id: string; bin_name: string; name?: string; notes?: string; tags?: string[]; area_name?: string; icon?: string; color?: string; card_style?: string; visibility?: 'location' | 'private'; custom_fields?: Record<string, string> }
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

export function buildSystemPrompt(request: CommandRequest, customPrompt?: string, isDemoUser?: boolean): string {
  const basePrompt = resolvePrompt(DEFAULT_COMMAND_PROMPT, customPrompt, isDemoUser);

  // Extract unique tags from bins already in context
  const existingTags = [...new Set(request.context.bins.flatMap((b) => b.tags))].sort();
  const tagBlock = existingTags.length > 0
    ? `\nExisting tags in this inventory: [${existingTags.join(', ')}]\nWhen adding tags (add_tags, create_bin, update_bin), you MUST reuse tags from this list whenever they are even loosely relevant. Only create a new tag when no existing tag covers the category. Do NOT create synonyms or variations of existing tags.`
    : '';

  return `${basePrompt}

Available action types:
- add_items: Add items to an existing bin. Fields: bin_id, bin_name, items[] (each item can be a string or {"name":"...","quantity":N})
- remove_items: Remove items from an existing bin. Fields: bin_id, bin_name, items[] (item name strings)
- modify_item: Change an item's name in a bin. Fields: bin_id, bin_name, old_item, new_item
- create_bin: Create a new bin. Fields: name, area_name (include when user specifies a location/area), tags[], items[] (ALWAYS include items when user mentions contents; each item can be a string or {"name":"...","quantity":N}), color?, icon?, notes?
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

IMPORTANT RULES:
1. Each action object MUST have a "type" field as a top-level property. All other fields are also top-level properties of the action object (NOT nested).
2. The "interpretation" field is REQUIRED and must always be present.
3. For create_bin: You MUST include "items" array when the user mentions any contents/items. You MUST include "area_name" when the user mentions a location/room/area. Do NOT put this information only in the interpretation — it must be in the action fields.

Example responses:
{"actions":[{"type":"remove_items","bin_id":"abc","bin_name":"Tools","items":["Hammer"]},{"type":"add_items","bin_id":"def","bin_name":"Garage","items":["Hammer"]}],"interpretation":"Move hammer from Tools to Garage"}
{"actions":[{"type":"create_bin","name":"Holiday Lights","area_name":"Garage","items":["LED string lights","Extension cord","Light clips"],"tags":["seasonal","holiday"]}],"interpretation":"Create a Holiday Lights bin in the Garage with 3 items."}${tagBlock}${HARDENING_INSTRUCTION}`;
}

export function buildUserMessage(request: CommandRequest): string {
  const { bins, areas, trash_bins } = request.context;
  return `Command: ${sanitizeForPrompt(request.text)}

<user_data type="inventory" trust="none">
${JSON.stringify({ bins, areas, trash_bins })}
</user_data>`;
}

/**
 * Build a unified system prompt that handles both commands AND queries.
 * The AI returns `{ actions, interpretation }` for commands or `{ answer, matches }` for queries.
 */
export function buildUnifiedSystemPrompt(request: CommandRequest, customCommandPrompt?: string, customQueryPrompt?: string, isDemoUser?: boolean): string {
  // Build the command half (action types, rules, examples)
  const commandPrompt = buildSystemPrompt(request, customCommandPrompt, isDemoUser);

  const defaultQueryBase = 'You are also an inventory search assistant. When the user asks a question (rather than giving a command), search through the inventory context and answer their question.';
  const queryBase = resolvePrompt(defaultQueryBase, customQueryPrompt, isDemoUser);

  return `${commandPrompt}

---

QUERY MODE (for questions instead of commands):
${queryBase}

Query rules:
- Answer in natural language, conversationally
- Reference specific bin names and areas when answering
- If items match partially, include them and note the partial match
- If nothing matches, say so clearly
- Sort matches by relevance (most relevant first)
- Return at most 8 matching bins. For each bin, include only the most relevant items (up to 10), not the entire list.
- Visibility, pin status, photo counts, and trash bins are available — use them to answer questions like "which bins are private?", "what's pinned?", "which bins have photos?", or "what's in the trash?"
- When including trash bins in matches, set "is_trashed": true so the UI can link to the trash page instead of the bin detail page.

---

RESPONSE FORMAT:
- If the user input is a COMMAND (create, move, add, delete, rename, etc.), respond with: {"actions":[...],"interpretation":"..."}
- If the user input is a QUESTION (where is, what's in, how many, do I have, etc.), respond with: {"answer":"...","matches":[{"bin_id":"...","name":"...","area_name":"...","items":["..."],"tags":["..."],"relevance":"...","is_trashed":false}]}
- For matches that are trash bins (from trash_bins in the context), set "is_trashed": true.
- If the command is ambiguous and you cannot determine actionable steps, treat it as a question.

Respond with ONLY valid JSON, no markdown fences, no extra text.`;
}
