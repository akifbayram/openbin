import { useMemo } from 'react';
import { useTerminology } from '@/lib/terminology';
import { categoryHeader, cn, flatCard } from '@/lib/utils';

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
            'Auto-tag these based on their contents',
            'What do these have in common?',
            `Move all of these to the Garage ${t.area}`,
            'Suggest better names for these',
            'Which of these contain electronics?',
          ]
        : [
            'Where is the cordless drill?',
            `What's in the Camping Gear ${t.bin}?`,
            `Which ${t.bins} have batteries?`,
            `Add bungee cords to the Car Supplies ${t.bin}`,
            `Create a ${t.bin} called Pool Floats in the Garage`,
            `Duplicate the Power Tools ${t.bin}`,
            "What's in my trash?",
          ],
    [isScoped, t],
  );

  return (
    <div className="pt-6 pb-4 space-y-4 animate-fade-in">
      <p className={categoryHeader}>Try asking</p>
      <div className="space-y-1.5">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onPickExample(example)}
            className={cn(
              flatCard,
              'block w-full text-left px-3 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-active)] transition-colors rounded-[var(--radius-sm)] [overflow-wrap:anywhere]',
            )}
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
