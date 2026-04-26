import { Layers, X } from 'lucide-react';
import { cn, focusRing } from '@/lib/utils';

interface BulkAddHintProps {
  photoCount: number;
  onSwitch: () => void;
  onDismiss: () => void;
}

export function BulkAddHint({ photoCount, onSwitch, onDismiss }: BulkAddHintProps) {
  return (
    <output
      aria-live="polite"
      className="rounded-[var(--radius-md)] border border-[var(--ai-accent)]/15 bg-[var(--ai-accent)]/[0.06] pl-3 pr-1.5 py-1.5 flex items-center gap-2"
    >
      <Layers className="h-4 w-4 shrink-0 text-[var(--ai-accent)]" aria-hidden="true" />
      <button
        type="button"
        onClick={onSwitch}
        className={cn(
          'flex-1 min-w-0 text-left text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-1 -my-1 rounded-[var(--radius-sm)]',
          focusRing,
        )}
      >
        {photoCount >= 2 ? `${photoCount} photos — ` : ''}
        <span>adding multiple bins? </span>
        <span className="font-medium text-[var(--ai-accent)]">Use Bulk Add →</span>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss bulk add hint"
        className={cn(
          'shrink-0 size-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors',
          focusRing,
        )}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </output>
  );
}
