import { X } from 'lucide-react';
import { useTerminology } from '@/lib/terminology';
import { plural } from '@/lib/utils';

interface ConversationScopePillProps {
  binCount: number;
  onClear: () => void;
}

export function ConversationScopePill({ binCount, onClear }: ConversationScopePillProps) {
  const t = useTerminology();
  return (
    <span className="inline-flex items-center gap-1 max-w-full min-w-0 bg-[var(--tab-pill-bg)] text-[var(--ai-accent)] px-2.5 py-0.5 rounded-full text-[12px]">
      <span className="truncate">Focused on {binCount} {plural(binCount, t.bin, t.bins)}</span>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 inline-flex items-center justify-center size-4 text-[var(--ai-accent)] hover:bg-[var(--ai-accent)]/10 rounded-full transition-colors"
        aria-label="Clear scope"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
