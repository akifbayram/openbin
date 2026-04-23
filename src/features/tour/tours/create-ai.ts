import { Camera } from 'lucide-react';
import type { TourDefinition } from '../tourRegistry';
import type { TourStep } from '../tourSteps';

const steps: TourStep[] = [
  {
    id: 'capture-camera',
    selector: '[data-tour="capture-camera"]',
    placement: 'bottom',
    title: 'Snap a photo',
    body: (ctx) =>
      `Point your camera at a shelf, drawer, or room — AI names the ${ctx.terminology.bin} and lists what's inside.`,
    route: '/capture',
    mobilePlacement: 'top',
  },
  {
    id: 'capture-grouping',
    selector: '[data-tour="capture-grouping"]',
    placement: 'top',
    title: 'Group as you go',
    body: (ctx) =>
      `Toggle grouping to turn multiple photos into multiple ${ctx.terminology.bins} in one pass.`,
    route: '/capture',
    mobilePlacement: 'top',
  },
  {
    id: 'group-review',
    selector: '[data-tour="group-review"]',
    placement: 'top',
    title: 'Review before confirming',
    body: 'Drag photos between groups, rename, or merge before the AI runs.',
    route: '/capture',
    condition: (ctx) => ctx.canWrite,
    mobilePlacement: 'top',
  },
  {
    id: 'bulk-add-confirm',
    selector: '[data-tour="bulk-add-confirm"]',
    placement: 'top',
    title: 'Create them all at once',
    body: (ctx) =>
      `AI suggestions are editable. Confirm to create every ${ctx.terminology.bin} in one go.`,
    route: '/capture',
    condition: (ctx) => ctx.canWrite,
    mobilePlacement: 'top',
    buttonLabel: 'Got it',
  },
];

export const createAi: TourDefinition = {
  id: 'create-ai',
  title: 'Create bins from photos',
  summary: 'Capture, group, and review AI-generated bins',
  icon: Camera,
  steps,
};
