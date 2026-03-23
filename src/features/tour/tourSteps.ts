import type { Terminology } from '@/lib/terminology';

// Bump this when tour content changes to re-trigger for returning users
export const TOUR_VERSION = 1;

export type Placement = 'top' | 'bottom' | 'left' | 'right';

export interface TourContext {
  canWrite: boolean;
  aiEnabled: boolean;
  firstBinId: string | null;
  terminology: Terminology;
  isMobile: boolean;
  openCommandInput: () => void;
  closeCommandInput: () => void;
}

export interface TourStep {
  id: string;
  /** CSS selector for the element to highlight */
  selector: string | ((ctx: TourContext) => string);
  /** Tooltip placement relative to target */
  placement: Placement;
  title: string | ((ctx: TourContext) => string);
  /** Body copy — string or function for adaptive text */
  body: string | ((ctx: TourContext) => string);
  /** Route the user must be on */
  route: string | ((ctx: TourContext) => string);
  /** Return false to skip this step. Omit = always show. */
  condition?: (ctx: TourContext) => boolean;
  /** Runs after element is found but before tooltip shows */
  beforeShow?: (ctx: TourContext) => void | Promise<void>;
  /** Runs when leaving this step */
  onLeave?: (ctx: TourContext) => void;
  /** Alternate selector on mobile (< lg breakpoint) */
  mobileSelector?: string;
  /** Override placement on mobile — forced to top/bottom */
  mobilePlacement?: 'top' | 'bottom';
  /** Custom label for the primary button (defaults to "Next" / "Done") */
  buttonLabel?: string | ((ctx: TourContext) => string);
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export const TOUR_STEPS: TourStep[] = [
  // 1. Ask AI — flagship AI feature
  {
    id: 'ask-ai',
    selector: (ctx) =>
      ctx.aiEnabled ? 'button[aria-label="Ask AI"]' : 'button[aria-label="Scan QR code"]',
    placement: 'bottom',
    title: 'Ask AI anything',
    body: (ctx) =>
      ctx.aiEnabled
        ? `Try "add batteries to the kitchen ${ctx.terminology.bin}" or "which ${ctx.terminology.bins} have tools?"`
        : `With an AI provider connected, you can manage your ${ctx.terminology.bins} by typing what you want in plain English. Set this up in Settings.`,
    route: '/bins',
    mobilePlacement: 'bottom',
  },

  // 2. Snap to Create — hidden gem (same route, opens dialog)
  {
    id: 'snap-to-create',
    selector: '[data-tour="photo-buttons"]',
    placement: 'bottom',
    title: (ctx) => `Photo to ${ctx.terminology.bin}`,
    body: (ctx) =>
      `Take a photo of a shelf or drawer. AI figures out what's there and creates a ${ctx.terminology.bin} for you.`,
    route: '/bins',
    condition: (ctx) => ctx.canWrite && ctx.aiEnabled,
    beforeShow: async (ctx) => {
      ctx.openCommandInput();
      await delay(400);
    },
    onLeave: (ctx) => {
      ctx.closeCommandInput();
    },
    mobilePlacement: 'top',
  },

  // 3. Scan QR (same route — all /bins stops grouped together before navigating away)
  {
    id: 'scan-qr',
    selector: 'button[aria-label="Scan QR code"]',
    placement: 'bottom',
    title: 'Scan a QR code',
    body: (ctx) =>
      `Point your camera at a label to jump to that ${ctx.terminology.bin}, or type the 6-character code.`,
    route: '/bins',
    mobilePlacement: 'bottom',
  },

  // 4. Bin detail — QR code
  {
    id: 'qr-section',
    selector: '[data-tour="qr-section"]',
    placement: 'top',
    title: (ctx) => `${ctx.terminology.Bin} QR code`,
    body: (ctx) =>
      `Print this label and stick it on your ${ctx.terminology.bin}. Anyone can scan it to see what's inside.`,
    route: (ctx) => (ctx.firstBinId ? `/bin/${ctx.firstBinId}` : '/bins'),
    condition: (ctx) => ctx.firstBinId !== null,
    beforeShow: async () => {
      const toggle = document.querySelector<HTMLButtonElement>(
        '[data-tour="qr-section"] button[aria-expanded="false"]',
      );
      if (toggle) {
        toggle.click();
        await delay(250);
      }
    },
    mobilePlacement: 'top',
  },

  // 5. Quick Add — AI item entry (same route as above)
  {
    id: 'quick-add',
    selector: '[data-tour="quick-add"]',
    placement: 'top',
    title: 'Quick add items',
    body: (ctx) =>
      ctx.aiEnabled
        ? `Type "3 screwdrivers, a tape measure, some nails" and tap the sparkle. AI parses it into items with quantities.`
        : `Type an item name and press Enter, or paste a list. With AI connected, you can describe items naturally.`,
    route: (ctx) => (ctx.firstBinId ? `/bin/${ctx.firstBinId}` : '/bins'),
    condition: (ctx) => ctx.canWrite && ctx.firstBinId !== null,
    mobilePlacement: 'top',
  },

  // 6. AI Reorganize
  {
    id: 'reorganize',
    selector: '[data-tour="reorganize-submit"]',
    placement: 'left',
    title: 'Reorganize with AI',
    body: (ctx) =>
      `Pick a few ${ctx.terminology.bins} and AI will suggest how to regroup them. Good for splitting overstuffed ${ctx.terminology.bins} or merging near-duplicates.`,
    route: '/reorganize',
    condition: (ctx) => ctx.canWrite && ctx.aiEnabled,
    mobilePlacement: 'top',
  },

  // 7. Print labels
  {
    id: 'print-labels',
    selector: '[data-tour="print-preview"]',
    placement: 'left',
    title: 'Print labels',
    body: (ctx) =>
      `Select ${ctx.terminology.bins}, pick a label style, and download a PDF. Print and stick them on the real thing.`,
    route: '/print',
    mobilePlacement: 'top',
  },

  // 8. CTA — call to action
  {
    id: 'cta',
    selector: (ctx) => {
      if (ctx.canWrite && ctx.aiEnabled) return 'button[aria-label="Ask AI"]';
      if (ctx.canWrite) return 'button[aria-label^="New"]';
      return '[data-shortcut-search]';
    },
    placement: 'bottom',
    title: 'That was the tour',
    body: (ctx) => {
      if (ctx.canWrite && ctx.aiEnabled)
        return `Try "create a ${ctx.terminology.bin} for kitchen utensils" to get started. You can replay this from Settings.`;
      if (ctx.canWrite)
        return `Create your next ${ctx.terminology.bin} to get going. You can replay this tour from Settings.`;
      return `You can replay this tour anytime from Settings.`;
    },
    route: '/bins',
    mobilePlacement: 'bottom',
    buttonLabel: (ctx) => {
      if (ctx.canWrite && ctx.aiEnabled) return 'Try it';
      if (ctx.canWrite) return `New ${ctx.terminology.bin}`;
      return 'Got it';
    },
  },
];

/** Filter steps based on current context */
export function filterSteps(steps: TourStep[], ctx: TourContext): TourStep[] {
  return steps.filter((step) => !step.condition || step.condition(ctx));
}

/** Resolve a step's selector for the current context */
export function resolveSelector(step: TourStep, ctx: TourContext): string {
  if (ctx.isMobile && step.mobileSelector) return step.mobileSelector;
  return typeof step.selector === 'function' ? step.selector(ctx) : step.selector;
}

/** Resolve a step's route for the current context */
export function resolveRoute(step: TourStep, ctx: TourContext): string {
  return typeof step.route === 'function' ? step.route(ctx) : step.route;
}

/** Resolve a step's title for the current context */
export function resolveTitle(step: TourStep, ctx: TourContext): string {
  return typeof step.title === 'function' ? step.title(ctx) : step.title;
}

/** Resolve a step's body text for the current context */
export function resolveBody(step: TourStep, ctx: TourContext): string {
  return typeof step.body === 'function' ? step.body(ctx) : step.body;
}

/** Resolve effective placement for context */
export function resolvePlacement(step: TourStep, ctx: TourContext): Placement {
  if (ctx.isMobile && step.mobilePlacement) return step.mobilePlacement;
  return step.placement;
}

/** Resolve custom button label, or null for default */
export function resolveButtonLabel(step: TourStep, ctx: TourContext): string | null {
  if (!step.buttonLabel) return null;
  return typeof step.buttonLabel === 'function' ? step.buttonLabel(ctx) : step.buttonLabel;
}
