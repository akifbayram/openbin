import { Shuffle } from 'lucide-react';
import type { TourDefinition } from '../tourRegistry';
import type { TourStep } from '../tourSteps';

const steps: TourStep[] = [
  {
    id: 'reorganize-mode',
    selector: '[data-tour="reorganize-mode"]',
    placement: 'bottom',
    title: 'Regroup bins or tags',
    body: (ctx) =>
      `Pick bins mode to split or merge overstuffed ${ctx.terminology.bins}; pick tags mode to consolidate tag vocabulary across ${ctx.terminology.bins}.`,
    route: '/reorganize',
    condition: (ctx) => ctx.canWrite && ctx.aiEnabled,
    mobilePlacement: 'bottom',
  },
  {
    id: 'reorganize-selector',
    selector: '[data-tour="reorganize-selector"]',
    placement: 'right',
    title: 'Focus the AI',
    body: (ctx) =>
      `Pick a handful of ${ctx.terminology.bins} or tags. The AI does better with focused input than the whole ${ctx.terminology.location}.`,
    route: '/reorganize',
    condition: (ctx) => ctx.canWrite && ctx.aiEnabled,
    mobilePlacement: 'bottom',
  },
  {
    id: 'reorganize-submit',
    selector: '[data-tour="reorganize-submit"]',
    placement: 'left',
    title: 'Preview, then apply',
    body: 'Preview every change before committing. Nothing moves until you say go.',
    route: '/reorganize',
    condition: (ctx) => ctx.canWrite && ctx.aiEnabled,
    mobilePlacement: 'top',
    buttonLabel: 'Got it',
  },
];

export const reorganize: TourDefinition = {
  id: 'reorganize',
  title: 'Reorganize with AI',
  summary: 'Regroup bins or consolidate tags',
  icon: Shuffle,
  steps,
};
