import { Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useTerminology } from '@/lib/terminology';
import { cn, flatCard } from '@/lib/utils';

interface EmptyConversationStateProps {
  isScoped: boolean;
  onPickExample: (text: string) => void;
}

export function EmptyConversationState({ isScoped, onPickExample }: EmptyConversationStateProps) {
  const t = useTerminology();

  const examples = useMemo(
    () =>
      isScoped
        ? [
            { label: 'Auto-tag', example: 'Auto-tag these based on their contents' },
            { label: 'Find common', example: 'What do these have in common?' },
            { label: 'Organize', example: `Move all of these to the Garage ${t.area}` },
            { label: 'Rename', example: 'Suggest better names for these' },
            { label: 'Search', example: 'Which of these contain electronics?' },
          ]
        : [
            { label: 'Add/remove items', example: 'Add screwdriver to the tools bin' },
            { label: 'Organize', example: 'Move batteries from kitchen to garage' },
            { label: `Manage ${t.bins}`, example: `Create a ${t.bin} called Holiday Decorations in the attic` },
            { label: 'Quick actions', example: `Duplicate the tools ${t.bin}` },
            { label: `Manage ${t.areas}`, example: `Rename the garage ${t.area} to workshop` },
            { label: 'Find things', example: 'Where is the glass cleaner?' },
            { label: 'Search trash', example: "What's in my trash?" },
          ],
    [isScoped, t],
  );

  return (
    <div className="space-y-3 pt-6 pb-4">
      <div className="text-center space-y-1">
        <Sparkles className="h-5 w-5 mx-auto text-[var(--accent)]" />
        <p className="text-[13px] text-[var(--text-secondary)]">
          Ask a question about your {t.bins} or tell the AI what to do.
        </p>
      </div>
      <div className="space-y-1.5">
        {examples.map(({ label, example }) => (
          <button
            key={label}
            type="button"
            onClick={() => onPickExample(example)}
            className={cn(
              flatCard,
              'block w-full text-left px-3 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-active)] transition-colors rounded-[var(--radius-sm)]',
            )}
          >
            <span className="text-[var(--text-secondary)]">{label}</span>
            {' — '}
            <span className="text-[var(--text-tertiary)]">&quot;{example}&quot;</span>
          </button>
        ))}
      </div>
    </div>
  );
}
