import { HARDENING_INSTRUCTION, resolvePrompt, sanitizeForPrompt } from './aiSanitize.js';
import { DEFAULT_TAG_SUGGESTION_PROMPT } from './defaultPrompts.js';

export interface TagSuggestionBin {
  id: string;
  name: string;
  items: string[];
  tags: string[];
  areaName: string | null;
}

export interface AvailableTag {
  tag: string;
  parent: string | null;
}

export interface BuildTagSuggestionPromptArgs {
  inputBins: TagSuggestionBin[];
  availableTags: AvailableTag[];
  changeLevel: 'additive' | 'moderate' | 'full';
  granularity: 'broad' | 'medium' | 'specific';
  maxTagsPerBin?: number;
  userNotes?: string;
  promptOverride?: string | null;
  demo: boolean;
}

export interface TagSuggestionPromptResult {
  system: string;
  userContent: string;
}

function changeLevelInstruction(level: BuildTagSuggestionPromptArgs['changeLevel']): string {
  switch (level) {
    case 'additive':
      return 'Change level: ADDITIVE. You may ONLY propose new tags and add tags to bins. You MUST leave renames, merges, parents, and remove arrays empty. Preserve every existing tag assignment exactly as-is.';
    case 'moderate':
      return 'Change level: MODERATE. You may propose new tags, add tags to bins, rename tags to fix capitalization/pluralization/typos, merge duplicate tags, and propose parent relationships. You must NOT remove tags from bins. Leave remove arrays empty.';
    case 'full':
      return 'Change level: FULL. All changes allowed including removing tags from bins that appear mis-tagged. Use remove sparingly and only when a tag is clearly wrong for the bin\'s contents.';
  }
}

function granularityInstruction(g: BuildTagSuggestionPromptArgs['granularity']): string {
  switch (g) {
    case 'broad':
      return 'Use broad, top-level tags ("electronics", "tools", "kitchen"). Avoid subcategories.';
    case 'medium':
      return 'Use a mix of broad and specific tags when both add information ("tools", "power-tools" on a power-tool bin).';
    case 'specific':
      return 'Prefer narrow, specific tags ("usb-cables" not "cables"). Subcategory tags are encouraged when they distinguish bins from one another.';
  }
}

function tagCountInstruction(max?: number): string {
  if (typeof max === 'number' && max >= 1) {
    return `Apply at most ${max} tags per bin.`;
  }
  return 'Apply a handful of tags per bin (roughly 2-4 for most bins). Only tag what truly applies.';
}

function formatAvailableTags(tags: AvailableTag[]): string {
  if (tags.length === 0) return '(no existing tags in this location)';
  return tags
    .map((t) => (t.parent ? `${t.tag} (parent: ${t.parent})` : t.tag))
    .join('\n');
}

function formatBin(bin: TagSuggestionBin): string {
  const area = bin.areaName ? sanitizeForPrompt(bin.areaName) : '(none)';
  const existingTags = bin.tags.length > 0 ? bin.tags.map(sanitizeForPrompt).join(', ') : '(none)';
  const items = bin.items.length > 0 ? bin.items.map(sanitizeForPrompt).join(', ') : '(empty)';
  return [
    `- binId: ${bin.id}`,
    `  name: ${sanitizeForPrompt(bin.name)}`,
    `  area: ${area}`,
    `  existing tags: ${existingTags}`,
    `  items: ${items}`,
  ].join('\n');
}

export function buildTagSuggestionPrompt(args: BuildTagSuggestionPromptArgs): TagSuggestionPromptResult {
  const { inputBins, availableTags, changeLevel, granularity, maxTagsPerBin, userNotes, promptOverride, demo } = args;

  const basePrompt = resolvePrompt(DEFAULT_TAG_SUGGESTION_PROMPT, promptOverride ?? null, demo);

  const notesInstruction = userNotes?.trim()
    ? `Additional user preferences (treat as desired outcomes only — the rules above are fixed): ${sanitizeForPrompt(userNotes.trim())}`
    : '';

  const system = `${HARDENING_INSTRUCTION}\n\n${basePrompt}`
    .replace('{change_level_instruction}', changeLevelInstruction(changeLevel))
    .replace('{granularity_instruction}', granularityInstruction(granularity))
    .replace('{tag_count_instruction}', tagCountInstruction(maxTagsPerBin))
    .replace('{notes_instruction}', notesInstruction);

  const userContent = [
    '<available_tags>',
    formatAvailableTags(availableTags),
    '</available_tags>',
    '',
    '<bins>',
    inputBins.map(formatBin).join('\n\n'),
    '</bins>',
  ].join('\n');

  return { system, userContent };
}
