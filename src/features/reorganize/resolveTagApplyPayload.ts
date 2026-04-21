import type { TagProposalResult, TagUserSelections } from './useReorganizeTags';

export interface TagApplyPayload {
  taxonomy: {
    newTags: Array<{ tag: string; parent?: string | null }>;
    renames: Array<{ from: string; to: string }>;
    merges: Array<{ from: string[]; to: string }>;
    parents: Array<{ tag: string; parent: string | null }>;
  };
  assignments: {
    add: Record<string, string[]>;
    remove: Record<string, string[]>;
  };
}

export function resolveTagApplyPayload(
  result: TagProposalResult,
  selections: TagUserSelections,
): TagApplyPayload {
  const newTags = result.taxonomy.newTags.filter((n) => selections.newTags.has(n.tag));
  const renames = result.taxonomy.renames.filter((r) => selections.renames.has(`${r.from}->${r.to}`));
  const merges = result.taxonomy.merges.filter((m) => selections.merges.has(m.to));
  const parents = result.taxonomy.parents.filter((p) => selections.parents.has(`${p.tag}->${p.parent}`));

  const introducedByNewTag = new Set(result.taxonomy.newTags.map((n) => n.tag));
  const introducedByRename = new Set(result.taxonomy.renames.map((r) => r.to));
  const introducedByMerge = new Set(result.taxonomy.merges.map((m) => m.to));
  const introducedTags = new Set([...introducedByNewTag, ...introducedByRename, ...introducedByMerge]);

  const keptByNewTag = new Set(newTags.map((n) => n.tag));
  const keptByRename = new Set(renames.map((r) => r.to));
  const keptByMerge = new Set(merges.map((m) => m.to));
  const keptIntroduced = new Set([...keptByNewTag, ...keptByRename, ...keptByMerge]);

  const shouldDrop = (tag: string): boolean => introducedTags.has(tag) && !keptIntroduced.has(tag);

  const add: Record<string, string[]> = {};
  const remove: Record<string, string[]> = {};

  for (const a of result.assignments) {
    if (!selections.assignments.has(a.binId)) continue;
    const filteredAdd = a.add.filter((t) => !shouldDrop(t));
    const filteredRemove = a.remove;
    if (filteredAdd.length > 0) add[a.binId] = filteredAdd;
    if (filteredRemove.length > 0) remove[a.binId] = filteredRemove;
  }

  return {
    taxonomy: { newTags, renames, merges, parents },
    assignments: { add, remove },
  };
}
