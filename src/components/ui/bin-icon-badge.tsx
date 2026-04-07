import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import type { ColorPreset } from '@/lib/colorPalette';

const FALLBACK_BG = { backgroundColor: 'var(--text-tertiary)' } as const;

interface BinIconBadgeProps {
  icon: LucideIcon;
  colorPreset: ColorPreset | null | undefined;
  /** When boolean, enables interactive mode with hover crossfade (requires `group` on ancestor). */
  selected?: boolean;
}

export function BinIconBadge({ icon: Icon, colorPreset, selected }: BinIconBadgeProps) {
  const bgStyle = colorPreset ? { backgroundColor: colorPreset.dot } : FALLBACK_BG;

  // Selected: accent + animated check
  if (selected) {
    return (
      <div
        data-testid="bin-icon-badge"
        className="h-5 w-5 shrink-0 flex items-center justify-center rounded-[var(--radius-xs)] bg-[var(--accent)] transition-colors duration-200"
      >
        <Check className="h-3 w-3 text-[var(--text-on-accent)] animate-check-pop" strokeWidth={3} />
      </div>
    );
  }

  // Interactive unselected: crossfade icon → empty checkbox on parent hover
  if (selected === false) {
    return (
      <div data-testid="bin-icon-badge" className="relative h-5 w-5 shrink-0 rounded-[var(--radius-xs)]">
        <div
          className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-xs)] transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-0"
          style={bgStyle}
        >
          <Icon className="h-3 w-3 text-white" />
        </div>
        <div className="absolute inset-0 rounded-[var(--radius-xs)] border-2 border-[var(--text-tertiary)] opacity-0 transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-100" />
      </div>
    );
  }

  // Non-interactive: plain badge
  return (
    <div
      data-testid="bin-icon-badge"
      className="h-5 w-5 shrink-0 flex items-center justify-center rounded-[var(--radius-xs)]"
      style={bgStyle}
    >
      <Icon className="h-3 w-3 text-white" />
    </div>
  );
}
