import { CheckSquare } from 'lucide-react';
import type { TourDefinition } from '../tourRegistry';
import { delay, type TourStep } from '../tourSteps';

// Remember the row we programmatically selected so we can un-select only that
// row at the end — preserving any additional rows the user selected themselves.
let autoSelectedRow: HTMLElement | null = null;

function selectFirstRow() {
  const cb = document.querySelector<HTMLElement>(
    '[data-tour="select-toggle"] [role="checkbox"]:not([aria-checked="true"])',
  );
  cb?.click();
  autoSelectedRow = cb;
}

function clearAutoSelection() {
  if (autoSelectedRow?.getAttribute('aria-checked') === 'true') {
    autoSelectedRow.click();
  }
  autoSelectedRow = null;
}

const steps: TourStep[] = [
  {
    id: 'select-toggle',
    selector: '[data-tour="select-toggle"]',
    placement: 'bottom',
    title: (ctx) => `Pick ${ctx.terminology.bins} to bulk edit`,
    body: (ctx) =>
      `Tap any row's checkbox to start selecting ${ctx.terminology.bins}.`,
    route: '/bins',
    mobilePlacement: 'bottom',
  },
  {
    id: 'bulk-action-bar',
    selector: '[data-tour="bulk-action-bar"]',
    placement: 'top',
    title: 'The action bar unlocks bulk edits',
    body: (ctx) =>
      `Tick one or more ${ctx.terminology.bins} and this bar floats up with every bulk action: tags, ${ctx.terminology.areas}, appearance, checkout status, or delete.`,
    route: '/bins',
    mobilePlacement: 'top',
    // Select a row so the action bar actually mounts — otherwise the step has
    // no anchor and silently auto-skips.
    beforeShow: async () => {
      selectFirstRow();
      // Let the animation settle so the tooltip anchors on the final rect.
      await delay(250);
    },
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
  onEnd: () => {
    clearAutoSelection();
  },
};
