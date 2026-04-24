import { CheckCircle2, type LucideIcon, MoreHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useClickOutside } from '@/lib/useClickOutside';
import { cn } from '@/lib/utils';

export interface BulkAction {
  id: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  /** Default true. */
  show?: boolean;
  danger?: boolean;
  group: 'primary' | 'more';
  /** 'more' group only — render a divider above this item. */
  dividerBefore?: boolean;
}

export interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkAction[];
  onClear: () => void;
  isBusy?: boolean;
  /** Default: `${count} selected`. */
  selectionLabel?: string;
}

export function BulkActionBar({ selectedCount, actions, onClear, isBusy, selectionLabel }: BulkActionBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useClickOutside(moreRef, useCallback(() => setMoreOpen(false), []));

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const visibleActions = actions.filter((a) => a.show !== false);
  const primary = visibleActions.filter((a) => a.group === 'primary');
  const more = visibleActions.filter((a) => a.group === 'more');

  function handleMoreAction(action: () => void) {
    setMoreOpen(false);
    action();
  }

  return (
    <div
      data-tour="bulk-action-bar"
      className={cn(
        'fixed z-50 left-1/2 -translate-x-1/2 lg:left-[calc(50%+130px)] max-w-[calc(100vw-2.5rem)]',
        'bottom-[calc(12px+var(--bottom-bar-height)+var(--safe-bottom))] lg:bottom-8',
        'transition-all duration-200',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
      )}
    >
      <div className="rounded-[var(--radius-md)] row px-3 py-2 bg-[var(--accent)] border border-[var(--accent-hover)] text-white sm:min-w-[400px] lg:min-w-[480px]">
        <CheckCircle2 className="h-4 w-4 text-white/80" />
        <span className="text-[13px] font-medium text-white/90 whitespace-nowrap">
          {selectionLabel ?? `${selectedCount} selected`}
        </span>
        <div className="h-4 border-l border-white/20" />

        {primary.map((action) => {
          const Icon = action.icon;
          return (
            <Tooltip key={action.id} content={action.label} side="top">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 px-2 sm:px-3',
                  action.danger
                    ? 'text-red-300 hover:bg-red-500/25 hover:text-red-200'
                    : 'text-white hover:bg-white/15',
                )}
                onClick={action.onClick}
                disabled={isBusy}
                aria-label={action.label}
              >
                <Icon className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">{action.label}</span>
              </Button>
            </Tooltip>
          );
        })}

        {more.length > 0 && (
          <div className="relative" ref={moreRef}>
            <Tooltip content="More actions" side="top">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-[var(--radius-xs)] text-white hover:bg-white/15"
                onClick={() => setMoreOpen((o) => !o)}
                disabled={isBusy}
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </Tooltip>
            {moreOpen && (
              <div className="absolute bottom-full mb-2 right-0 rounded-[var(--radius-md)] min-w-[180px] z-50 flat-popover overflow-hidden">
                {more.map((action) => {
                  const Icon = action.icon;
                  return (
                    <div key={action.id}>
                      {action.dividerBefore && <div className="my-1 border-t border-[var(--border-primary)]" />}
                      <button
                        type="button"
                        className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                        onClick={() => handleMoreAction(action.onClick)}
                        aria-label={action.label}
                      >
                        <Icon className="h-4 w-4 text-[var(--text-tertiary)]" />
                        {action.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="h-4 border-l border-white/20" />
        <Tooltip content="Clear selection" side="top">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-[var(--radius-xs)] text-white/70 hover:bg-white/15 hover:text-white"
            onClick={onClear}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
