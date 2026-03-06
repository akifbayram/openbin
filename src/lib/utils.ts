import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Returns `singular` when count === 1, otherwise `pluralForm` (defaults to singular + "s"). */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

export function haptic(pattern: number | number[] = 10) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

// ── Shared UI class constants ──────────────────────────────────────

/** Focus ring used on buttons, switches, checkboxes, and similar interactive controls. */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2';

/** Focus ring variant without offset — for inputs embedded in containers. */
export const focusRingInset =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

/** Shared disabled styling for interactive elements. */
export const disabledClasses = 'disabled:cursor-not-allowed disabled:opacity-40';

/** Base classes shared by Input, Textarea, and similar form controls. */
export const inputBase =
  'w-full rounded-[var(--radius-sm)] bg-[var(--bg-input)] px-3.5 py-2.5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40';

/** Glass card base — shared by Card, Table, ListItem. */
export const glassCard = 'glass-card rounded-[var(--radius-lg)]';

/** Overlay backdrop — shared by Dialog and CommandPalette. */
export const overlayBackdrop =
  'fixed inset-0 bg-[var(--overlay-backdrop)] backdrop-blur-sm transition-opacity';

/** Small uppercase category/section header text. */
export const categoryHeader =
  'text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]';
