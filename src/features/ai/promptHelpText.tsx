import type { ReactNode } from 'react';

export type PromptTab = 'analysis' | 'command' | 'query' | 'structure' | 'reorganization' | 'tagSuggestion';

const V = ({ children }: { children: string }) => (
  <code className="text-[var(--text-xs)] px-1 py-0.5 rounded bg-[var(--bg-input)]">{children}</code>
);

export const PROMPT_HELP_TEXT: Record<PromptTab, ReactNode> = {
  analysis: <>Existing tags and custom fields are passed automatically in the user message. This prompt defines the instructions only.</>,
  command: <>Inventory context (bins, items, areas, tags, colors, icons) is passed automatically. This prompt defines the instructions only.</>,
  query: <>Inventory context (bins, items, areas, tags) is passed automatically. This prompt defines the instructions only.</>,
  structure: <>Bin name and existing items are appended automatically. This prompt defines the extraction rules.</>,
  reorganization: <>Available variables: <V>{'{max_bins_instruction}'}</V> <V>{'{area_instruction}'}</V> <V>{'{strictness_instruction}'}</V> <V>{'{granularity_instruction}'}</V> <V>{'{duplicates_instruction}'}</V> <V>{'{ambiguous_instruction}'}</V> <V>{'{outliers_instruction}'}</V> <V>{'{items_per_bin_instruction}'}</V> <V>{'{notes_instruction}'}</V>. Existing tags are passed automatically in the user message.</>,
  tagSuggestion: <>Governs AI tag suggestions (Tags mode on the Reorganize page). The model sees the full tag vocabulary of the location plus a list of bins with items/area/existing tags, and proposes a cleaner taxonomy and per-bin assignments. Available variables: <V>{'{change_level_instruction}'}</V> <V>{'{granularity_instruction}'}</V> <V>{'{tag_count_instruction}'}</V> <V>{'{notes_instruction}'}</V>.</>,
};
