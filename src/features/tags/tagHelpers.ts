import type { TagEntry } from './useTags';

/**
 * Tags eligible to be a parent: present in the list, not themselves children, and not in the excluded set.
 *
 * Used by both single-tag "Set Parent" and bulk "Set Parent" dialogs.
 */
export function getParentEligibleTags(
  tags: TagEntry[],
  tagParents: Map<string, string>,
  excluded: Set<string> | string[] = new Set(),
): string[] {
  const exclSet = excluded instanceof Set ? excluded : new Set(excluded);
  return tags.map((t) => t.tag).filter((name) => !tagParents.has(name) && !exclSet.has(name));
}
