// Type-only stub — full implementation added in Task 12.
export interface TagProposalResult {
  taxonomy: {
    newTags: Array<{ tag: string; parent?: string | null }>;
    renames: Array<{ from: string; to: string }>;
    merges: Array<{ from: string[]; to: string }>;
    parents: Array<{ tag: string; parent: string | null }>;
  };
  assignments: Array<{ binId: string; add: string[]; remove: string[] }>;
  summary: string;
}

export interface TagUserSelections {
  newTags: Set<string>;
  renames: Set<string>;
  merges: Set<string>;
  parents: Set<string>;
  assignments: Set<string>;
}
