import { MessageCircle } from 'lucide-react';
import { formatKeys } from '@/lib/shortcuts';
import type { TourDefinition } from '../tourRegistry';
import { delay, type TourContext, type TourStep } from '../tourSteps';

const askRoute = (ctx: TourContext) => (ctx.isMobile ? '/ask' : '/');

const steps: TourStep[] = [
  {
    id: 'open-palette',
    selector: '[data-tour="ask-composer"]',
    placement: 'bottom',
    title: 'Ask anything',
    body: (ctx) => {
      if (ctx.isMobile) return `Ask where something is, or tell AI what to do.`;
      const [shortcut] = formatKeys('mod+j');
      return `Open Ask AI with ${shortcut} from anywhere.`;
    },
    route: askRoute,
    mobilePlacement: 'bottom',
    // Open the palette once on entry; subsequent steps rely on it staying open.
    // Tour-level `onEnd` handles the close so we don't flash open/closed between steps.
    beforeShow: async (ctx) => {
      if (ctx.isMobile) return;
      ctx.openCommandInput();
      await delay(400);
    },
  },
  {
    id: 'voice-input',
    selector: '[data-tour="voice-input"]',
    placement: 'top',
    title: 'Talk instead of type',
    body: 'Tap the mic to dictate — great for hands-busy capture.',
    route: askRoute,
    mobilePlacement: 'top',
  },
  {
    id: 'photo-to-bin',
    selector: '[data-tour="photo-to-bin"]',
    placement: 'top',
    title: 'Drop a photo into the chat',
    body: (ctx) =>
      `Attach a photo and AI creates a ${ctx.terminology.bin} from it — items, tags, notes included.`,
    route: askRoute,
    condition: (ctx) => ctx.canWrite,
    mobilePlacement: 'top',
  },
  {
    id: 'try-query',
    selector: '[data-tour="ask-composer"]',
    placement: 'top',
    title: 'Try a query',
    body: (ctx) =>
      `Ask "where are the batteries?" or "create a kitchen utensils ${ctx.terminology.bin}".`,
    route: askRoute,
    mobilePlacement: 'top',
    buttonLabel: 'Got it',
  },
];

export const askAi: TourDefinition = {
  id: 'ask-ai',
  title: 'Ask AI & voice',
  summary: 'Palette, voice dictation, photo-to-bin',
  icon: MessageCircle,
  steps,
  onEnd: (ctx) => {
    if (!ctx.isMobile) ctx.closeCommandInput();
  },
};
