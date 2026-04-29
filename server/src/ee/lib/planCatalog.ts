import { config } from '../../lib/config.js';
import type { PlanFeatures } from '../../lib/planGate.js';
import { getFeatureMap, Plan } from '../../lib/planGate.js';

export type CatalogPlanId = 'free' | 'plus' | 'pro';

export interface CatalogPlan {
  id: CatalogPlanId;
  name: string;
  prices: {
    monthly: number;
    annual: number | null;
  };
  features: PlanFeatures;
}

export interface PlanCatalog {
  plans: CatalogPlan[];
}

export function getPlanCatalog(): PlanCatalog {
  const { planPrices } = config;
  return {
    plans: [
      { id: 'free', name: 'Free', prices: { monthly: 0, annual: null }, features: getFeatureMap(Plan.FREE) },
      { id: 'plus', name: 'Plus', prices: { monthly: planPrices.plusMonthlyCents, annual: planPrices.plusAnnualCents }, features: getFeatureMap(Plan.PLUS) },
      { id: 'pro',  name: 'Pro',  prices: { monthly: planPrices.proMonthlyCents,  annual: planPrices.proAnnualCents  }, features: getFeatureMap(Plan.PRO)  },
    ],
  };
}
