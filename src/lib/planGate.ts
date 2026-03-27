import type { PlanTier } from '@/types';

export function isGatedPlan(plan: PlanTier): boolean {
  return plan === 'lite';
}
