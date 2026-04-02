import { Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  label: string;
  done: boolean;
  action?: () => void;
  actionLabel?: string;
}

interface DashboardChecklistProps {
  totalBins: number;
  totalItems: number;
  onDismiss: () => void;
}

export function DashboardChecklist({ totalBins, totalItems, onDismiss }: DashboardChecklistProps) {
  const navigate = useNavigate();
  const t = useTerminology();

  const hasBins = totalBins > 0;
  const hasItems = totalItems > 0;

  const items: ChecklistItem[] = [
    {
      label: `Create your first ${t.bin}`,
      done: hasBins,
      action: () => navigate('/bins', { state: { create: true } }),
      actionLabel: `Create ${t.bin}`,
    },
    {
      label: `Add items to a ${t.bin}`,
      done: hasItems,
      action: hasBins ? () => navigate('/bins') : undefined,
      actionLabel: hasBins ? `Go to ${t.bins}` : undefined,
    },
    {
      label: 'Print your first QR label',
      done: false,
      action: hasBins ? () => navigate('/print') : undefined,
      actionLabel: hasBins ? 'Print labels' : undefined,
    },
  ];

  const completedCount = items.filter((i) => i.done).length;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-flat)] bg-[var(--bg-flat)] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">Get started</p>
          <p className="text-[12px] text-[var(--text-tertiary)]">{completedCount} of {items.length} complete</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss checklist"
          className="p-2 -m-1 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-1 rounded-full bg-[var(--bg-input)] mb-3">
        <div
          className="h-1 rounded-full bg-[var(--accent)] transition-all duration-300 motion-reduce:transition-none"
          style={{ width: `${(completedCount / items.length) * 100}%` }}
        />
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3 py-1.5">
            <div className={cn(
              'h-5 w-5 rounded-full flex items-center justify-center shrink-0 border',
              item.done
                ? 'bg-[var(--accent)] border-[var(--accent)]'
                : 'border-[var(--border-flat)]',
            )}>
              {item.done && <Check className="h-3 w-3 text-[var(--text-on-accent)]" />}
            </div>
            <span className={cn(
              'flex-1 text-[14px]',
              item.done ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-primary)]',
            )}>
              {item.label}
            </span>
            {!item.done && item.action && item.actionLabel && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-[12px]"
                onClick={item.action}
              >
                {item.actionLabel}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
