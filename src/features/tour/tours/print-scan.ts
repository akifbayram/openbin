import { Printer } from 'lucide-react';
import type { TourDefinition } from '../tourRegistry';
import { scanButtonSelector, type TourContext, type TourStep } from '../tourSteps';

const steps: TourStep[] = [
  {
    id: 'print-bin-selector',
    selector: '[data-tour="print-bin-selector"]',
    placement: 'right',
    title: (ctx) => `Pick which ${ctx.terminology.bins} to print`,
    body: (ctx) =>
      `Print labels for a handful of ${ctx.terminology.bins} or for everything. Deep-link here from any list.`,
    route: (ctx: TourContext) => {
      const ids = ctx.binIds.slice(0, 6);
      return ids.length > 0 ? `/print?ids=${ids.join(',')}` : '/print';
    },
    mobilePlacement: 'bottom',
  },
  {
    id: 'print-mode',
    selector: '[data-tour="print-mode"]',
    placement: 'bottom',
    title: 'Labels, names, or item lists',
    body: 'Pick a format: QR labels for scanning, name cards, or a full item checklist for inventory counts.',
    route: '/print',
    mobilePlacement: 'bottom',
  },
  {
    id: 'print-preset',
    selector: '[data-tour="print-preset"]',
    placement: 'bottom',
    title: 'Customize and save presets',
    body: 'Turn on Customize dimensions to tweak any margin, then save your tweaks as a reusable preset — next print job is one click.',
    route: '/print',
    mobilePlacement: 'bottom',
  },
  {
    id: 'scan-qr',
    selector: scanButtonSelector,
    placement: 'bottom',
    title: 'Scan the printed label',
    body: 'Point your camera at any printed label to jump to its bin — no typing needed.',
    route: '/',
    mobilePlacement: 'bottom',
    buttonLabel: 'Got it',
  },
];

export const printScan: TourDefinition = {
  id: 'print-scan',
  title: 'Print & scan',
  summary: 'Label formats, presets, and QR scanning',
  icon: Printer,
  steps,
};
