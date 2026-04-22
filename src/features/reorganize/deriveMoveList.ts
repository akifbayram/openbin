import type { Bin, BinItem } from '@/types';
import type { ResolvedReorgPartial } from './resolveReorgIndexes';
import type { ReorgResponse } from './useReorganize';

export interface MoveListItem {
  name: string;
  quantity: number | null;
  /** Set to N > 1 when the same item name appears in multiple destinations under the same source. */
  multiDestinationCount?: number;
}

export interface SourceClusterRow {
  destinationName: string;
  destinationTags: string[];
  items: MoveListItem[];
  /**
   * True when this cluster's destination name matches the source bin's name (normalized),
   * meaning the existing source bin will be preserved and renamed content-wise to this destination.
   */
  destinationKept: boolean;
}

export interface SourceCard {
  sourceBin: Bin;
  outgoingClusters: SourceClusterRow[];
  /**
   * True when this source bin's name matches at least one destination in the AI output (normalized).
   * Under identity preservation, such a source is typically updated in place instead of deleted on apply.
   *
   * Edge case: when multiple selected source bins share the same name and only one output destination
   * has that name, all matching sources show `preserved: true` here, but `buildReorganizePlan` picks
   * a single overlap winner at apply time — the losing duplicates are deleted. This divergence only
   * affects the rare duplicate-source-name scenario; the typical 1-to-1 case is always consistent.
   */
  preserved: boolean;
}

export interface MoveListDerivation {
  sourceCards: SourceCard[];
  /**
   * Total number of items moving, summed across source cards. When an item name appears
   * in multiple source bins routed to the same destination, it is counted once per source
   * — matching the number of physical pieces the user needs to move.
   */
  totalItems: number;
  totalMoves: number;
  totalDestinationBins: number;
}

/** An AI output bin as it travels through the plan. Mirrors `ReorgResponse['bins'][number]`. */
export interface ReorganizeOutputBin {
  name: string;
  items: string[];
  tags?: string[];
}

export interface ReorganizePlan {
  /** Source bins whose name matches a destination — updated in place. */
  preservations: Array<{ sourceBinId: string; destBin: ReorganizeOutputBin }>;
  /** Source bin ids that should be deleted (unmatched sources). */
  deletions: string[];
  /** Destination bins with no matching source — created fresh. */
  creations: ReorganizeOutputBin[];
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

type NormalizedOutputBin = Pick<ReorgResponse['bins'][number], 'name' | 'items' | 'tags'>;

function coerceResult(
  result: ReorgResponse | ResolvedReorgPartial,
): NormalizedOutputBin[] {
  return result.bins.map((b) => ({
    name: b.name,
    items: b.items,
    tags: (b as { tags?: string[] }).tags ?? [],
  }));
}

/**
 * Build a source-oriented view model from the original input bins and the AI's reorganize output.
 * - Items are matched to source bins by normalized name lookup.
 * - Output items with no source match are skipped (the server guarantees this does not happen in production;
 *   this is defensive behaviour for partial-parse / streaming edge cases).
 * - Source cards are returned in the order of `inputBins`.
 * - Destination order within each source mirrors the AI output order.
 * - A source is marked `preserved` when its name matches at least one destination (normalized).
 * - A cluster is marked `destinationKept` when its destination name matches this cluster's source name.
 */
export function deriveMoveList(
  inputBins: Bin[],
  result: ReorgResponse | ResolvedReorgPartial,
): MoveListDerivation {
  const outputBins = coerceResult(result);
  const outputNameSet = new Set(outputBins.map((b) => normalize(b.name)));

  const nameToSources = new Map<string, Set<string>>();
  const inputItemMap = new Map<string, BinItem[]>();
  for (const bin of inputBins) {
    inputItemMap.set(bin.id, bin.items);
    for (const item of bin.items) {
      const n = normalize(item.name);
      let set = nameToSources.get(n);
      if (!set) {
        set = new Set<string>();
        nameToSources.set(n, set);
      }
      set.add(bin.id);
    }
  }

  interface ClusterAccumulator {
    destinationName: string;
    destinationTags: string[];
    itemNames: string[];
    itemDisplay: Map<string, { display: string; quantity: number | null }>;
  }
  const clustersBySource = new Map<string, ClusterAccumulator[]>();
  const ensureClusters = (sourceId: string) => {
    let arr = clustersBySource.get(sourceId);
    if (!arr) {
      arr = [];
      clustersBySource.set(sourceId, arr);
    }
    return arr;
  };

  for (const outBin of outputBins) {
    for (const rawItem of outBin.items) {
      const n = normalize(rawItem);
      const sources = nameToSources.get(n);
      if (!sources) continue;

      for (const sourceId of sources) {
        const sourceItems = inputItemMap.get(sourceId) ?? [];
        const match = sourceItems.find((it) => normalize(it.name) === n);
        const quantity = match?.quantity ?? null;
        const display = rawItem;

        const clusters = ensureClusters(sourceId);
        let cluster: ClusterAccumulator | undefined = clusters.find((c) => c.destinationName === outBin.name);
        if (!cluster) {
          cluster = {
            destinationName: outBin.name,
            destinationTags: outBin.tags ?? [],
            itemNames: [],
            itemDisplay: new Map(),
          };
          clusters.push(cluster);
        }
        const resolvedCluster = cluster;
        if (!resolvedCluster.itemDisplay.has(n)) {
          resolvedCluster.itemNames.push(n);
          resolvedCluster.itemDisplay.set(n, { display, quantity });
        }
      }
    }
  }

  const sourceCards: SourceCard[] = inputBins.map((sourceBin) => {
    const rawClusters = clustersBySource.get(sourceBin.id) ?? [];
    const normalizedSourceName = normalize(sourceBin.name);
    const preserved = outputNameSet.has(normalizedSourceName);

    const destCountInSource = new Map<string, number>();
    for (const c of rawClusters) {
      for (const n of c.itemNames) {
        destCountInSource.set(n, (destCountInSource.get(n) ?? 0) + 1);
      }
    }

    const outgoingClusters: SourceClusterRow[] = rawClusters.map((c) => ({
      destinationName: c.destinationName,
      destinationTags: c.destinationTags,
      destinationKept: normalize(c.destinationName) === normalizedSourceName,
      items: c.itemNames.map((n) => {
        const disp = c.itemDisplay.get(n);
        const display = disp?.display ?? n;
        const quantity = disp?.quantity ?? null;
        const destCount = destCountInSource.get(n) ?? 1;
        const item: MoveListItem = { name: display, quantity };
        if (destCount > 1) item.multiDestinationCount = destCount;
        return item;
      }),
    }));

    return { sourceBin, outgoingClusters, preserved };
  });

  const totalItems = sourceCards.reduce(
    (sum, s) => sum + s.outgoingClusters.reduce((n, c) => n + c.items.length, 0),
    0,
  );
  const totalMoves = sourceCards.reduce((sum, s) => sum + s.outgoingClusters.length, 0);
  const totalDestinationBins = outputBins.length;

  return { sourceCards, totalItems, totalMoves, totalDestinationBins };
}

/**
 * Score how well a candidate source bin matches a proposed destination: count of items
 * in the source whose normalized name appears in the destination's item list.
 */
function scoreOverlap(source: Bin, destItems: string[]): number {
  const destNames = new Set(destItems.map(normalize));
  let count = 0;
  for (const item of source.items) {
    if (destNames.has(normalize(item.name))) count++;
  }
  return count;
}

/**
 * Build an apply-time plan: which source bins to preserve (update in place), which to delete,
 * and which destinations to create fresh.
 *
 * Rule: for each destination, preserve the source with matching normalized name. If multiple
 * sources share that name, pick the one with the highest item-name overlap to the destination;
 * ties are broken by original selection order of `inputBins`. Each source can be preserved at most once.
 */
export function buildReorganizePlan(
  inputBins: Bin[],
  result: ReorgResponse,
): ReorganizePlan {
  const preservations: ReorganizePlan['preservations'] = [];
  const creations: ReorganizeOutputBin[] = [];
  const claimed = new Set<string>();

  const sourcesByName = new Map<string, Bin[]>();
  for (const bin of inputBins) {
    const n = normalize(bin.name);
    let list = sourcesByName.get(n);
    if (!list) {
      list = [];
      sourcesByName.set(n, list);
    }
    list.push(bin);
  }

  for (const destBin of result.bins) {
    const candidates = (sourcesByName.get(normalize(destBin.name)) ?? []).filter((b) => !claimed.has(b.id));
    if (candidates.length === 0) {
      creations.push({ name: destBin.name, items: destBin.items, tags: destBin.tags });
      continue;
    }

    let winner = candidates[0];
    let winnerScore = scoreOverlap(winner, destBin.items);
    for (let i = 1; i < candidates.length; i++) {
      const score = scoreOverlap(candidates[i], destBin.items);
      if (score > winnerScore) {
        winner = candidates[i];
        winnerScore = score;
      }
    }

    claimed.add(winner.id);
    preservations.push({
      sourceBinId: winner.id,
      destBin: { name: destBin.name, items: destBin.items, tags: destBin.tags },
    });
  }

  const deletions: string[] = inputBins
    .filter((b) => !claimed.has(b.id))
    .map((b) => b.id);

  return { preservations, deletions, creations };
}
