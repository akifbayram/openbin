import type { Terminology } from '@/lib/terminology';

// Bump this when tour content changes to re-trigger for returning users
export const TOUR_VERSION = 2;

export type Placement = 'top' | 'bottom' | 'left' | 'right';

export interface TourContext {
  canWrite: boolean;
  aiEnabled: boolean;
  firstBinId: string | null;
  binIds: string[];
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
  // 1. Dashboard overview — orient user on landing page
  {
    id: 'dashboard-overview',
    selector: '[data-tour="dashboard-overview"]',
    placement: 'bottom',
    title: 'Welcome home',
    body: (ctx) =>
      `Your dashboard surfaces pinned ${ctx.terminology.bins}, recent scans, and an activity heatmap so you can see what's moving.`,
    route: '/',
    mobilePlacement: 'bottom',
  },

  // 2. Ask AI — flagship AI feature
  {
    id: 'ask-ai',
    selector: (ctx) =>
      ctx.aiEnabled ? 'button[aria-label="Ask AI"]' : 'button[aria-label="Scan QR code"]',
    placement: 'bottom',
    title: (ctx) => (ctx.aiEnabled ? 'Ask AI anything' : `Find your ${ctx.terminology.bins}`),
    body: (ctx) => {
      if (!ctx.aiEnabled) {
        return `Use the search bar to find ${ctx.terminology.bins} by name, tag, or contents. Scan a QR label to jump straight to one.`;
      }
      const shortcut = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '\u2318J' : 'Ctrl+J';
      return `Ask where something is, or tell it what to do — AI can create, edit, and find ${ctx.terminology.bins}. Try ${shortcut}.`;
    },
    route: '/',
    mobilePlacement: 'bottom',
  },

  // 3. Photo-to-bin — flagship AI creation flow
  {
    id: 'photo-to-bin',
    selector: '[data-tour="photo-to-bin"]',
    placement: 'top',
    title: (ctx) => `Create a ${ctx.terminology.bin} from a photo`,
    body: (ctx) =>
      `Snap a photo of a shelf, drawer, or container. AI identifies what's inside and creates a ${ctx.terminology.bin} for you — items, tags, and notes included.`,
    route: (ctx) => (ctx.isMobile ? '/ask' : '/'),
    condition: (ctx) => ctx.canWrite && ctx.aiEnabled,
    beforeShow: async (ctx) => {
      if (ctx.isMobile) return;
      ctx.openCommandInput();
      await delay(400);
    },
    onLeave: (ctx) => {
      if (!ctx.isMobile) ctx.closeCommandInput();
    },
    mobilePlacement: 'top',
  },

  // 4. Scan QR / search
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

  // 5. Bin detail — QR section in the rail
  {
    id: 'bin-qr',
    selector: '[data-tour="qr-section"]',
    placement: 'top',
    title: (ctx) => `Every ${ctx.terminology.bin} has a QR code`,
    body: (ctx) =>
      `Print this label and stick it on your ${ctx.terminology.bin}. Anyone with access to this ${ctx.terminology.location} can scan to see what's inside.`,
    route: (ctx) => (ctx.firstBinId ? `/bin/${ctx.firstBinId}` : '/'),
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

  // 6. Bin detail — quick add
  {
    id: 'quick-add',
    selector: '[data-tour="quick-add"]',
    placement: 'top',
    title: 'Add items fast',
    body: (ctx) =>
      ctx.aiEnabled
        ? `Type "3 screwdrivers, a tape measure, some nails" and tap the spark icon — AI parses it into items with quantities.`
        : `Type an item name and press Enter. Paste a comma-separated list to add several at once.`,
    route: (ctx) => (ctx.firstBinId ? `/bin/${ctx.firstBinId}` : '/'),
    condition: (ctx) => ctx.canWrite && ctx.firstBinId !== null,
    mobilePlacement: 'top',
  },

  // 7. Bin detail — tab bar (Contents / Files / Info)
  {
    id: 'bin-tabs',
    selector: '[data-tour="bin-tabs"]',
    placement: 'bottom',
    title: "See what's happening",
    body: (ctx) =>
      `Switch tabs for files, a usage heatmap, and activity history — so you know when this ${ctx.terminology.bin} was last opened and what changed.`,
    route: (ctx) => (ctx.firstBinId ? `/bin/${ctx.firstBinId}` : '/'),
    condition: (ctx) => ctx.firstBinId !== null,
    mobilePlacement: 'bottom',
  },

  // 8. Print modes (labels / names / item list)
  {
    id: 'print-mode',
    selector: '[data-tour="print-mode"]',
    placement: 'bottom',
    title: 'Print labels, names, or item lists',
    body: (ctx) =>
      `Pick a format: QR labels for scanning, name cards for quick identification, or a full item checklist for inventory counts on your ${ctx.terminology.bins}.`,
    route: (ctx) => {
      const ids = ctx.binIds.slice(0, 6);
      return ids.length > 0 ? `/print?ids=${ids.join(',')}` : '/print';
    },
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

  // 9. AI Reorganize
  {
    id: 'reorganize',
    selector: '[data-tour="reorganize-submit"]',
    placement: 'left',
    title: 'Reorganize with AI',
    body: (ctx) =>
      `Pick a few ${ctx.terminology.bins} and AI suggests how to regroup them — good for splitting overstuffed ${ctx.terminology.bins} or merging similar ones.`,
    route: '/reorganize',
    condition: (ctx) => ctx.canWrite && ctx.aiEnabled,
    mobilePlacement: 'top',
  },

  // 10. CTA — call to action
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
        return `Try "create a ${ctx.terminology.bin} for kitchen utensils" to get started. You can replay this tour from Settings.`;
      if (ctx.canWrite)
        return `Create your next ${ctx.terminology.bin} to get going. You can replay this tour from Settings.`;
      return `You can replay this tour anytime from Settings.`;
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
