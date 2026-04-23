import type { LucideIcon } from 'lucide-react';
import type { TourContext, TourStep } from './tourSteps';
import { askAi } from './tours/ask-ai';
import { binAnatomy } from './tours/bin-anatomy';
import { bulkEdit } from './tours/bulk-edit';
import { createAi } from './tours/create-ai';
import { highlights } from './tours/highlights';
import { printScan } from './tours/print-scan';
import { reorganize } from './tours/reorganize';

export type TourId =
  | 'highlights'
  | 'create-ai'
  | 'ask-ai'
  | 'bin-anatomy'
  | 'print-scan'
  | 'reorganize'
  | 'bulk-edit';

export interface TourDefinition {
  id: TourId;
  title: string;
  summary: string;
  icon: LucideIcon;
  steps: TourStep[];
  autoFire?: boolean;
  /** Runs once when the tour ends (complete or skip). Use for tour-wide cleanup
   *  (e.g. closing a palette) rather than repeating it in every step's onLeave. */
  onEnd?: (ctx: TourContext) => void;
}

export const TOURS_VERSION = 1;

export const TOURS: Record<TourId, TourDefinition> = {
  highlights,
  'create-ai': createAi,
  'ask-ai': askAi,
  'bin-anatomy': binAnatomy,
  'print-scan': printScan,
  reorganize,
  'bulk-edit': bulkEdit,
};

export function getTour(id: TourId): TourDefinition | null {
  return TOURS[id] ?? null;
}

const ALL_TOURS: readonly TourDefinition[] = Object.freeze(Object.values(TOURS));

export function listTours(): readonly TourDefinition[] {
  return ALL_TOURS;
}

/** Append-unique helper for `tours_seen`. Returns the same array when `tourId` is already present
 *  so callers using functional `updatePreferences` can avoid redundant API writes. */
export function markTourSeen(seen: readonly string[] | undefined, tourId: TourId): string[] {
  const list = seen ?? [];
  if (list.includes(tourId)) return list as string[];
  return [...list, tourId];
}
