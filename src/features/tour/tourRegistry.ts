import type { LucideIcon } from 'lucide-react';
import type { TourStep } from './tourSteps';

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

export const TOURS: Record<TourId, TourDefinition> = {} as Record<TourId, TourDefinition>;

export function getTour(id: TourId): TourDefinition | null {
  return TOURS[id] ?? null;
}

export function listTours(): TourDefinition[] {
  return Object.values(TOURS);
}
