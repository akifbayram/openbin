import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface CompletionAction {
  icon: LucideIcon;
  label: string;
  path: string;
}

export interface CompletionStepProps {
  icon: React.ReactNode;
  actions: CompletionAction[];
  onAction: (path: string) => void;
  onDashboard: () => void;
}

export function CompletionStep({ icon, actions, onAction, onDashboard }: CompletionStepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      {icon}
      <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
        You're ready to go
      </h2>
      <p className="text-[14px] text-[var(--text-tertiary)] mb-5 leading-relaxed">
        Here are a few things you can do next.
      </p>
      <div className="w-full space-y-2 mb-6">
        {actions.map(({ icon: Icon, label, path }) => (
          <button
            key={path}
            type="button"
            onClick={() => onAction(path)}
            className="w-full flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 bg-[var(--bg-active)] hover:bg-[var(--bg-hover)] transition-colors text-left"
          >
            <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-[var(--accent)]/10">
              <Icon className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <span className="text-[14px] font-medium text-[var(--text-primary)]">{label}</span>
          </button>
        ))}
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
