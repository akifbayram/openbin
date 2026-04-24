import { Package } from 'lucide-react';
import type { TourDefinition } from '../tourRegistry';
import type { TourContext, TourStep } from '../tourSteps';

const route = (ctx: TourContext) =>
  ctx.firstBinId ? `/bin/${ctx.firstBinId}` : '/';

const steps: TourStep[] = [
  {
    id: 'bin-qr',
    selector: '[data-tour="bin-qr"]',
    placement: 'top',
    title: (ctx) => `Every ${ctx.terminology.bin} has a code`,
    body: (ctx) =>
      `The 6-character code is a printable QR. Stick it on the ${ctx.terminology.bin} — anyone in this ${ctx.terminology.location} can scan or type it.`,
    route,
    condition: (ctx) => ctx.firstBinId !== null,
    mobilePlacement: 'top',
  },
  {
    id: 'quick-add',
    selector: '[data-tour="quick-add"]',
    placement: 'top',
    title: 'Add items fast',
    body: (ctx) =>
      ctx.aiEnabled
        ? 'Type "3 screwdrivers, a tape measure" and tap the spark — AI parses it into items with quantities.'
        : 'Type an item name and press Enter. Paste a comma-separated list for multiple.',
    route,
    condition: (ctx) => ctx.canWrite && ctx.firstBinId !== null,
    mobilePlacement: 'top',
  },
  {
    id: 'bin-tabs',
    selector: '[data-tour="bin-tabs"]',
    placement: 'bottom',
    title: "See what's happening",
    body: (ctx) =>
      `Switch tabs for files, a usage heatmap, and activity — see when this ${ctx.terminology.bin} was last opened and what changed.`,
    route,
    condition: (ctx) => ctx.firstBinId !== null,
    mobilePlacement: 'bottom',
  },
  {
    id: 'bin-appearance',
    selector: '[data-tour="bin-appearance"]',
    placement: 'top',
    title: 'Tags, area, and appearance',
    body: (ctx) =>
      `Tags filter across ${ctx.terminology.bins}, ${ctx.terminology.areas} group them, and appearance themes printed labels.`,
    route,
    condition: (ctx) => ctx.firstBinId !== null,
    mobilePlacement: 'top',
  },
  {
    id: 'bin-toolbar',
    selector: '[data-tour="bin-toolbar"]',
    placement: 'bottom',
    title: 'Edit, pin, print, duplicate',
    body: 'The toolbar has every action you need: edit contents, pin for quick access, print a label, duplicate, or move.',
    route,
    condition: (ctx) => ctx.firstBinId !== null,
    mobilePlacement: 'bottom',
    buttonLabel: 'Got it',
  },
];

export const binAnatomy: TourDefinition = {
  id: 'bin-anatomy',
  title: 'Inside a bin',
  summary: 'Items, tags, QR, tabs, toolbar',
  icon: Package,
  steps,
};
