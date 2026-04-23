import type { LucideIcon } from 'lucide-react';
import type { TourStep } from './tourSteps';
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

export function listTours(): TourDefinition[] {
  return Object.values(TOURS);
}
