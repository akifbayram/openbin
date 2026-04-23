import { Printer } from 'lucide-react';
import type { TourDefinition } from '../tourRegistry';
import type { TourContext, TourStep } from '../tourSteps';

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

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
    beforeShow: async () => {
      const { savePrintSettings, DEFAULT_PRINT_SETTINGS, DEFAULT_LABEL_OPTIONS } =
        await import('@/features/print/usePrintSettings');
      await savePrintSettings({
        ...DEFAULT_PRINT_SETTINGS,
        formatKey: 'avery-5163',
        labelOptions: { ...DEFAULT_LABEL_OPTIONS, showBinName: false },
      });
      window.dispatchEvent(new Event('print-settings-changed'));
      await delay(300);
    },
    mobilePlacement: 'bottom',
  },
  {
    id: 'print-preset',
    selector: '[data-tour="print-preset"]',
    placement: 'bottom',
    title: 'Save your template',
    body: 'Save a preset so next print job is one click — Avery 5163 + names hidden, for example.',
    route: '/print',
    mobilePlacement: 'bottom',
  },
  {
    id: 'scan-qr',
    selector: 'button[aria-label="Scan QR code"]',
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
