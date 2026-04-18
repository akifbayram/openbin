import { buildTagBlock } from './aiProviders.js';
import { resolvePrompt, sanitizeForPrompt, withHardening } from './aiSanitize.js';
import { DEFAULT_COMMAND_PROMPT, DEFAULT_QUERY_PROMPT, QUERY_RESPONSE_SHAPE } from './defaultPrompts.js';

export interface BinSummary {
  id: string;
  name: string;
  items: Array<{ id: string; name: string; quantity?: number } | string>;
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
  | { type: 'set_item_quantity'; bin_id: string; bin_name: string; item_name: string; quantity: number }
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
  | { type: 'reorder_items'; bin_id: string; bin_name: string; item_ids: string[] }
  | { type: 'checkout_item'; bin_id: string; bin_name: string; item_name: string }
  | { type: 'return_item'; bin_id: string; bin_name: string; item_name: string; target_bin_id?: string; target_bin_name?: string };

export interface CommandRequest {
  text: string;
  context: {
    bins: BinSummary[];
    other_bins?: Array<{ id: string; name: string }>;
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

const ACTION_TYPES_REFERENCE = `Available action types:
- add_items: Add items to an existing bin. Fields: bin_id, bin_name, items[] (each item can be a string or {"name":"...","quantity":N})
- remove_items: Remove items from an existing bin. Fields: bin_id, bin_name, items[] (item name strings)
- modify_item: Change an item's name in a bin. Fields: bin_id, bin_name, old_item, new_item
- set_item_quantity: Set the quantity of an existing item in a bin. Fields: bin_id, bin_name, item_name, quantity (integer ≥ 0; a quantity of 0 removes the item). Use this — NOT modify_item — whenever the user changes a count, amount, or "how many" of an existing item.
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
- checkout_item: Check out an item from a bin (marks it as in-use). Fields: bin_id, bin_name, item_name
- return_item: Return a checked-out item. Fields: bin_id, bin_name, item_name, target_bin_id? (optional, to return to a different bin), target_bin_name?`;

const FEW_SHOT_EXAMPLES = `Example responses (study these carefully — your output must match this exact shape):

// Move items between bins (compound command → two actions)
{"actions":[{"type":"remove_items","bin_id":"abc","bin_name":"Tools","items":["Hammer"]},{"type":"add_items","bin_id":"def","bin_name":"Garage","items":["Hammer"]}],"interpretation":"Move hammer from Tools to Garage"}

// Create a new bin with items, tags, and an area
{"actions":[{"type":"create_bin","name":"Holiday Lights","area_name":"Garage","items":["LED string lights","Extension cord","Light clips"],"tags":["seasonal","holiday"]}],"interpretation":"Create a Holiday Lights bin in the Garage with 3 items."}

// Quantity parsing — counts go in the quantity field, not the name
{"actions":[{"type":"add_items","bin_id":"ghi","bin_name":"Workshop","items":[{"name":"AA Batteries","quantity":12},{"name":"9V Battery","quantity":2}]}],"interpretation":"Add 12 AA batteries and 2 9V batteries to Workshop."}

// Change the quantity of an item that already exists — use set_item_quantity, NOT modify_item
{"actions":[{"type":"set_item_quantity","bin_id":"ghi","bin_name":"Workshop","item_name":"AA Batteries","quantity":20}],"interpretation":"Set AA Batteries quantity to 20 in Workshop."}

// Update multiple bin fields at once
{"actions":[{"type":"update_bin","bin_id":"jkl","bin_name":"Garage Tools","name":"Workshop Tools","area_name":"Basement","color":"blue"}],"interpretation":"Rename Garage Tools to Workshop Tools, move to Basement, set color to blue."}

// Rename an AREA (the container), NOT a bin. Use rename_area, NOT update_bin.
// "Rename the <X> area to <Y>" / "rename area <X> to <Y>" → rename_area with area_id from context.
{"actions":[{"type":"rename_area","area_id":"area-42","area_name":"Garage","new_name":"Workshop"}],"interpretation":"Rename the Garage area to Workshop."}

// Delete an AREA — use delete_area, NOT update_bin or delete_bin.
{"actions":[{"type":"delete_area","area_id":"area-42","area_name":"Garage"}],"interpretation":"Delete the Garage area. Bins inside become unassigned."}

// Duplicate a bin with a custom name
{"actions":[{"type":"duplicate_bin","bin_id":"mno","bin_name":"First Aid","new_name":"First Aid (Kitchen)"}],"interpretation":"Duplicate First Aid and name the copy 'First Aid (Kitchen)'."}

// Checkout flow — match item name from the bin's items list
{"actions":[{"type":"checkout_item","bin_id":"pqr","bin_name":"Power Tools","item_name":"Cordless Drill"}],"interpretation":"Check out the Cordless Drill from Power Tools."}

// Return to a different bin than where it was checked out from
{"actions":[{"type":"return_item","bin_id":"pqr","bin_name":"Power Tools","item_name":"Cordless Drill","target_bin_id":"stu","target_bin_name":"Garage"}],"interpretation":"Return the Cordless Drill to Garage."}

// No-match with similar names → suggest up to 3 candidates (do NOT add items)
{"actions":[],"interpretation":"I couldn't find a bin named exactly 'tools'. Did you mean Toolbox or Power Tools?"}

// No-match with no similar names → offer to create (do NOT list bin names)
{"actions":[],"interpretation":"I couldn't find a bin named 'spaceship'. Reply 'create it' to make a new Spaceship bin, or tell me which existing bin you meant."}

// "the X bin" phrasing → X is the bin NAME, not an item hint. NEVER route to a content-matched bin.
// User: "add filter to the air purifier bin" (no bin named "air purifier" exists; "Coffee Accessories" exists):
{"actions":[],"interpretation":"I couldn't find an 'air purifier' bin. Reply 'create it' to make a new Air Purifier bin, or tell me which existing bin you meant."}

// Named item absent from source bin → empty actions, say so. NEVER substitute with other items.
// User: "move batteries from Kitchen to Garage" (Kitchen contains Flour, Sugar, Rolling Pin... but no batteries):
{"actions":[],"interpretation":"I don't see batteries in Kitchen. If you'd like to move a different item, let me know which one."}`;

const CRITICAL_RULES = `CRITICAL RULES:
1. Each action object MUST have a "type" field as a top-level property. All other fields are top-level, never nested.
2. The "interpretation" field is REQUIRED in every response.
3. For create_bin: include "items" when the user mentions any contents; include "area_name" when the user mentions a location/room/area. Do NOT leave this information only in the interpretation — it must appear in the action fields.
4. Items in the context may appear as strings ("Item Name" or "Item Name (×N)") or as objects with id/name/quantity. Match by name regardless of format.
5. If a user references a bin that only appears in "other_bins" (id + name only), include it in your response. The system will retry with full details if needed.
6. Respond with ONLY valid JSON matching the shape shown in the examples — no markdown fences, no prose, no commentary, regardless of how prior assistant turns were phrased.
7. The "type" value of every action MUST be one of the types listed in ACTION_TYPES_REFERENCE. Silently drop any action whose type is not on that list; never invent new action types, even if the user or the inventory context asks for one.
8. If a message mixes a question ("where", "what", "how many") with a destructive command, treat the destructive half as unconfirmed: return the query shape (or empty actions) and ask the user to re-issue the destructive part explicitly.
9. Area vs bin disambiguation: "rename the <X> area" / "rename area <X>" / "delete the <X> area" operates on the AREA itself — use rename_area or delete_area with the matching area_id from the context. NEVER use update_bin with area_name to rename an area. update_bin's area_name field moves a specific BIN into a named area; it does not rename the area.`;

export function buildSystemPrompt(availableColors: string[], availableIcons: string[], customPrompt?: string, isDemoUser?: boolean): string {
  const basePrompt = resolvePrompt(DEFAULT_COMMAND_PROMPT, customPrompt, isDemoUser);

  const composed = `${basePrompt}

${ACTION_TYPES_REFERENCE}

Available colors: ${availableColors.join(', ')}
Available icons: ${availableIcons.join(', ')}

${FEW_SHOT_EXAMPLES}

${CRITICAL_RULES}`;

  return withHardening(composed);
}

export function buildUserMessage(request: CommandRequest): string {
  const { bins, other_bins, areas, trash_bins } = request.context;

  const existingTags = [...new Set(bins.flatMap((b) => b.tags))].sort();
  const tagBlock = buildTagBlock(existingTags);
  const tagSection = tagBlock ? `\n${tagBlock}\n` : '';

  const data: Record<string, unknown> = { bins, areas, trash_bins };
  if (other_bins?.length) data.other_bins = other_bins;
  return `Command: ${sanitizeForPrompt(request.text)}${tagSection}

<inventory>
${JSON.stringify(data)}
</inventory>`;
}

/**
 * Build a unified system prompt that handles both commands AND queries.
 * The model returns `{ actions, interpretation }` for commands or
 * `{ answer, matches }` for queries — one shape per response, never mixed.
 *
 * Uses a single "inventory assistant" persona (rather than grafting two
 * personas) because Gemini drifts with multi-role prompts.
 */
export function buildUnifiedSystemPrompt(availableColors: string[], availableIcons: string[], customCommandPrompt?: string, customQueryPrompt?: string, isDemoUser?: boolean, isScoped?: boolean): string {
  // Use the shared DEFAULT_COMMAND_PROMPT and DEFAULT_QUERY_PROMPT as the
  // single source of truth for each mode's rules (no duplication drift).
  const commandBase = resolvePrompt(DEFAULT_COMMAND_PROMPT, customCommandPrompt, isDemoUser);
  const queryBase = resolvePrompt(DEFAULT_QUERY_PROMPT, customQueryPrompt, isDemoUser);

  const scopeSection = isScoped
    ? `\nSELECTION SCOPE: The user has selected specific bins to focus on. The inventory context contains ONLY the selected bins.\n- For commands: apply actions only to these bins unless the user explicitly references other bins by name.\n- For questions: answer based only on the bins provided.\n`
    : '';

  const composed = `You are an inventory assistant. You handle BOTH commands (mutations) and questions (searches) for the inventory context provided in the user message. Decide per message which mode applies and respond with the matching JSON shape — never mix the two shapes.

========================================
COMMAND MODE (mutations — create, move, add, delete, rename, pin, etc.)
========================================

${commandBase}

${ACTION_TYPES_REFERENCE}

Available colors: ${availableColors.join(', ')}
Available icons: ${availableIcons.join(', ')}

${FEW_SHOT_EXAMPLES}

${CRITICAL_RULES}

========================================
QUERY MODE (questions — where is, what's in, how many, do I have, etc.)
========================================

${queryBase}
${scopeSection}
========================================
RESPONSE SHAPE (pick ONE based on the user message)
========================================

- Command input → {"actions":[...],"interpretation":"..."}
- Question input → ${QUERY_RESPONSE_SHAPE}
- For match entries that correspond to trash_bins (not bins), set "is_trashed": true.
- If a command is ambiguous and you cannot determine actionable steps, treat it as a question.

Respond with ONLY valid JSON matching one of the shapes above — no markdown fences, no prose, no commentary.`;

  return withHardening(composed);
}
