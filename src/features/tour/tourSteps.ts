import type { Terminology } from '@/lib/terminology';

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

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Shared scan-button selector: mobile nav vs. desktop toolbar button. */
export const scanButtonSelector = (ctx: TourContext): string =>
  ctx.isMobile
    ? 'nav[aria-label="Main navigation"] button[aria-label="Scan"]'
    : '[data-tour="scan-button"]';
