import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, focusRing } from '@/lib/utils';

export type CompletionAction = {
  icon: LucideIcon;
  label: string;
  description?: string;
} & ({ path: string } | { onSelect: () => void });

export interface CompletionStepProps {
  icon: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions: CompletionAction[];
  onAction: (action: CompletionAction) => void;
  onDashboard: () => void;
}

export function CompletionStep({ icon, title, subtitle, actions, onAction, onDashboard }: CompletionStepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="onboarding-completion-icon">{icon}</div>
      <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
        {title ?? "You're all set"}
      </h2>
      <p className="text-[14px] text-[var(--text-tertiary)] mb-5 leading-relaxed">
        {subtitle ?? 'Jump into any of these to get started.'}
      </p>
      <div className="w-full space-y-2 mb-6">
        {actions.map((action, i) => {
          const { icon: Icon, label, description } = action;
          return (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: completion actions are static within a step
              key={i}
              type="button"
              onClick={() => onAction(action)}
              className={cn(
                'onboarding-action-card w-full flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 bg-[var(--bg-active)] hover:bg-[var(--bg-hover)] transition-colors text-left',
                focusRing,
              )}
              style={{ animationDelay: `${0.1 + i * 0.07}s` }}
            >
              <div className="h-8 w-8 rounded-[var(--radius-xl)] flex items-center justify-center shrink-0 bg-[var(--accent)]/10">
                <Icon className="h-4 w-4 text-[var(--accent)]" />
              </div>
              <div className="min-w-0">
                <span className="text-[14px] font-medium text-[var(--text-primary)]">{label}</span>
                {description && (
                  <p className="text-[12px] text-[var(--text-tertiary)] leading-snug">{description}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        onClick={onDashboard}
        className="w-full rounded-[var(--radius-md)] h-11 text-[15px]"
      >
        Go to Dashboard
      </Button>
    </div>
  );
}
