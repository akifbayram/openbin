import type { DowngradeImpact } from '@/types';

export const FIXTURE_IMPACT_FREE: DowngradeImpact = {
  targetPlan: 'free',
  warnings: [
    { kind: 'usage-exceeded', title: '47 bins (Free allows 10)',     description: '37 bins will become read-only.' },
    { kind: 'usage-exceeded', title: '3 locations (Free allows 1)',  description: '2 locations will become read-only.' },
    { kind: 'feature-loss',   title: 'AI features',                   description: 'AI photo recognition, ask-AI, and reorganize will be disabled.' },
    { kind: 'feature-loss',   title: 'Custom fields',                 description: "Existing values stay; you can't add new ones." },
  ],
};
