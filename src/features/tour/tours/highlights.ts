import { Sparkles } from 'lucide-react';
import { formatKeys } from '@/lib/shortcuts';
import type { TourDefinition } from '../tourRegistry';
import type { TourStep } from '../tourSteps';

const steps: TourStep[] = [
  {
    id: 'dashboard-overview',
    selector: '[data-tour="dashboard-overview"]',
    placement: 'bottom',
    title: 'Welcome home',
    body: (ctx) =>
      `Your dashboard surfaces pinned ${ctx.terminology.bins}, recent scans, checkouts, and an activity heatmap so you can see what's moving.`,
    route: '/',
    mobilePlacement: 'bottom',
  },
  {
    id: 'ask-ai',
    selector: (ctx) =>
      ctx.isMobile
        ? 'nav[aria-label="Main navigation"] button[aria-label="Ask AI"]'
        : 'button[aria-label="Ask AI"]',
    placement: 'bottom',
    title: (ctx) => (ctx.aiEnabled ? 'Ask AI anything' : `Find your ${ctx.terminology.bins}`),
    body: (ctx) => {
      if (!ctx.aiEnabled) {
        return `Use the search bar to find ${ctx.terminology.bins} by name, tag, or contents.`;
      }
      const [shortcut] = formatKeys('mod+j');
      return `Ask where something is, or tell it what to do — AI can create, edit, and find ${ctx.terminology.bins}. Try ${shortcut}.`;
    },
    route: '/',
    condition: (ctx) => ctx.aiEnabled,
    mobilePlacement: 'top',
  },
  {
    id: 'scan-qr',
    selector: 'button[aria-label="Scan QR code"]',
    placement: 'bottom',
    title: 'Scan or search',
    body: (ctx) =>
      `Point your camera at a label to jump straight to that ${ctx.terminology.bin}, or type its 6-character code.`,
    route: '/',
    mobilePlacement: 'bottom',
  },
  {
    id: 'nav-sidebar',
    selector: '[data-tour="nav-sidebar"]',
    placement: 'right',
    title: 'Cross-bin views',
    body: (ctx) =>
      `Open Items, Tags, or ${ctx.terminology.Areas} for cross-${ctx.terminology.bin} views and bulk edits — plus the trash and activity log.`,
    route: '/',
    mobileSelector: 'nav[aria-label="Main navigation"]',
    mobilePlacement: 'top',
  },
  {
    id: 'cta',
    selector: (ctx) => {
      if (ctx.canWrite && ctx.aiEnabled) return 'button[aria-label="Ask AI"]';
      if (ctx.canWrite) return 'button[aria-label^="New"]';
      return '[data-shortcut-search]';
    },
    placement: 'bottom',
    title: 'That was the highlights',
    body: (ctx) => {
      if (ctx.canWrite && ctx.aiEnabled) {
        return `Try "create a ${ctx.terminology.bin} for kitchen utensils" to get started. More tours are available from the "?" button on each page, or from Settings.`;
      }
      if (ctx.canWrite) {
        return `Create your next ${ctx.terminology.bin} to get going. More tours are available from the "?" button on each page, or from Settings.`;
      }
      return `More tours are available from the "?" button on each page, or from Settings.`;
    },
    route: '/',
    mobilePlacement: 'bottom',
    buttonLabel: (ctx) => {
      if (ctx.canWrite && ctx.aiEnabled) return 'Try it';
      if (ctx.canWrite) return `New ${ctx.terminology.bin}`;
      return 'Got it';
    },
  },
];

export const highlights: TourDefinition = {
  id: 'highlights',
  title: 'Highlights',
  summary: 'Dashboard, Ask AI, scan, and cross-bin views',
  icon: Sparkles,
  steps,
  autoFire: true,
};
