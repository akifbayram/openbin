import { CheckSquare } from 'lucide-react';
import type { TourDefinition } from '../tourRegistry';
import type { TourStep } from '../tourSteps';

const steps: TourStep[] = [
  {
    id: 'select-toggle',
    selector: '[data-tour="select-toggle"]',
    placement: 'bottom',
    title: 'Pick rows to bulk edit',
    body: 'Tap any row’s checkbox to start selecting. Works on bins, items, tags, and checkouts.',
    route: '/bins',
    mobilePlacement: 'bottom',
  },
  {
    id: 'bulk-action-bar',
    selector: '[data-tour="bulk-action-bar"]',
    placement: 'top',
    title: "The action bar appears when you've selected",
    body: 'Once you tick one or more rows, the bar floats up with every bulk action available for that list.',
    route: '/bins',
    mobilePlacement: 'top',
  },
  {
    id: 'bulk-dialog',
    selector: '[data-tour="bulk-action-bar"]',
    placement: 'top',
    title: 'Set tags, area, appearance — or delete',
    body: (ctx) =>
      `Bulk dialogs set tags, ${ctx.terminology.areas}, appearance, checkout status, or delete across everything selected.`,
    route: '/bins',
    mobilePlacement: 'top',
  },
  {
    id: 'undo-toast',
    selector: '[data-tour="select-toggle"]',
    placement: 'bottom',
    title: 'One toast, one undo',
    body: 'Bulk deletes can be reversed from a single coalesced undo toast — no per-item confirmation needed.',
    route: '/bins',
    mobilePlacement: 'bottom',
    buttonLabel: 'Got it',
  },
];

export const bulkEdit: TourDefinition = {
  id: 'bulk-edit',
  title: 'Bulk edit',
  summary: 'Select, action bar, and coalesced undo',
  icon: CheckSquare,
  steps,
};
