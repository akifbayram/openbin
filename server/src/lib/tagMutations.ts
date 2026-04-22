import { d, generateUuid } from '../db.js';

type TxQuery = <T = unknown>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;

export interface TagMutations {
  renames?: Array<{ from: string; to: string }>;
  merges?: Array<{ from: string[]; to: string }>;
  parents?: Array<{ tag: string; parent: string | null }>;
  deletes?: string[];
  newTags?: Array<{ tag: string; parent?: string | null }>;
  // Per-bin assignments (used by /bulk-apply)
  adds?: Record<string, string[]>;
  removes?: Record<string, string[]>;
}

export interface TagMutationCounts {
  tagsCreated: number;
  tagsRenamed: number;
  tagsMerged: number;
  tagsDeleted: number;
  parentsSet: number;
  binsUpdated: number;
  binsAddedTo: number;
  binsRemovedFrom: number;
  orphanedChildren: number;
  childrenReassigned: number;
}

export function detectParentCycle(parents: Array<{ tag: string; parent: string | null }>): string | null {
  const map = new Map<string, string | null>();
  for (const p of parents) map.set(p.tag, p.parent);
  for (const [tag] of map) {
    const seen = new Set<string>();
    let cur: string | null | undefined = tag;
    while (cur) {
      if (seen.has(cur)) return tag;
      seen.add(cur);
      cur = map.get(cur) ?? null;
    }
  }
  return null;
}

export async function applyTagMutations(
  txQuery: TxQuery,
  locationId: string,
  m: TagMutations,
): Promise<TagMutationCounts> {
  const counts: TagMutationCounts = {
    tagsCreated: 0,
    tagsRenamed: 0,
    tagsMerged: 0,
    tagsDeleted: 0,
    parentsSet: 0,
    binsUpdated: 0,
    binsAddedTo: 0,
    binsRemovedFrom: 0,
    orphanedChildren: 0,
    childrenReassigned: 0,
  };

  const allRenames: Array<{ from: string; to: string }> = [
    ...(m.renames ?? []),
    ...(m.merges ?? []).flatMap((mg) => mg.from.map((f) => ({ from: f, to: mg.to }))),
  ];

  for (const r of allRenames) {
    const result = await txQuery<{ updated: number }>(
      `UPDATE bins
         SET tags = (
           SELECT ${d.jsonGroupArray('tag')} FROM (
             SELECT DISTINCT CASE WHEN jt.value = $2 THEN $3 ELSE jt.value END AS tag
             FROM ${d.jsonEachFrom('bins.tags', 'jt')}
           )
         ),
         updated_at = ${d.now()}
       WHERE location_id = $1
         AND deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM ${d.jsonEachFrom('tags', 'jt2')} WHERE jt2.value = $2)
       RETURNING 1 AS updated`,
      [locationId, r.from, r.to],
    );
    counts.binsUpdated += result.rows.length;

    const reass = await txQuery<{ tag: string }>(
      `UPDATE tag_colors SET parent_tag = $1, updated_at = ${d.now()}
         WHERE location_id = $2 AND parent_tag = $3
         RETURNING tag`,
      [r.to, locationId, r.from],
    );
    counts.childrenReassigned += reass.rows.length;

    await txQuery(
      `UPDATE tag_colors SET tag = $1, updated_at = ${d.now()}
         WHERE location_id = $2 AND tag = $3`,
      [r.to, locationId, r.from],
    );
  }

  counts.tagsRenamed = (m.renames ?? []).length;
  counts.tagsMerged = (m.merges ?? []).length;

  for (const n of m.newTags ?? []) {
    await txQuery(
      `INSERT INTO tag_colors (id, location_id, tag, color, parent_tag)
         VALUES ($1, $2, $3, '', $4)
         ON CONFLICT (location_id, tag) DO NOTHING`,
      [generateUuid(), locationId, n.tag, n.parent ?? null],
    );
    counts.tagsCreated += 1;
  }

  for (const p of m.parents ?? []) {
    const result = await txQuery<{ updated: number }>(
      `UPDATE tag_colors SET parent_tag = $1, updated_at = ${d.now()}
         WHERE location_id = $2 AND tag = $3
         RETURNING 1 AS updated`,
      [p.parent, locationId, p.tag],
    );
    if (result.rows.length > 0) counts.parentsSet += 1;
  }

  for (const tag of m.deletes ?? []) {
    const upd = await txQuery<{ updated: number }>(
      `UPDATE bins
         SET tags = (
           SELECT ${d.jsonGroupArray('jt.value')}
           FROM ${d.jsonEachFrom('bins.tags', 'jt')}
           WHERE jt.value != $2
         ),
         updated_at = ${d.now()}
       WHERE location_id = $1
         AND deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM ${d.jsonEachFrom('tags', 'jt2')} WHERE jt2.value = $2)
       RETURNING 1 AS updated`,
      [locationId, tag],
    );
    counts.binsUpdated += upd.rows.length;

    const orphaned = await txQuery<{ tag: string }>(
      `UPDATE tag_colors SET parent_tag = NULL, updated_at = ${d.now()}
         WHERE location_id = $1 AND parent_tag = $2
         RETURNING tag`,
      [locationId, tag],
    );
    counts.orphanedChildren += orphaned.rows.length;

    await txQuery(
      `DELETE FROM tag_colors WHERE location_id = $1 AND tag = $2`,
      [locationId, tag],
    );
    counts.tagsDeleted += 1;
  }

  for (const [binId, tags] of Object.entries(m.adds ?? {})) {
    if (tags.length === 0) continue;
    const result = await txQuery<{ updated: number }>(
      `UPDATE bins SET tags = (
         SELECT ${d.jsonGroupArray('tag')} FROM (
           SELECT DISTINCT jt.value AS tag FROM ${d.jsonEachFrom('bins.tags', 'jt')}
           UNION SELECT value AS tag FROM ${d.jsonEachFrom('$1', 'jt_new')}
         )
       ), updated_at = ${d.now()}
       WHERE id = $2 AND location_id = $3 AND deleted_at IS NULL
       RETURNING 1 AS updated`,
      [JSON.stringify(tags), binId, locationId],
    );
    if (result.rows.length > 0) counts.binsAddedTo += 1;
  }

  for (const [binId, tags] of Object.entries(m.removes ?? {})) {
    if (tags.length === 0) continue;
    const result = await txQuery<{ updated: number }>(
      `UPDATE bins SET tags = (
         SELECT ${d.jsonGroupArray('jt.value')}
         FROM ${d.jsonEachFrom('bins.tags', 'jt')}
         WHERE jt.value NOT IN (SELECT value FROM ${d.jsonEachFrom('$1', 'jt_rem')})
       ), updated_at = ${d.now()}
       WHERE id = $2 AND location_id = $3 AND deleted_at IS NULL
       RETURNING 1 AS updated`,
      [JSON.stringify(tags), binId, locationId],
    );
    if (result.rows.length > 0) counts.binsRemovedFrom += 1;
  }

  return counts;
}
