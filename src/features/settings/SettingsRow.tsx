import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn, focusRing } from '@/lib/utils';

interface SettingsRowProps {
  label: string;
  description?: ReactNode;
  control?: ReactNode;
  onClick?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  border?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}

export function SettingsRow({
  label,
  description,
  control,
  onClick,
  icon: Icon,
  border = true,
  destructive,
  disabled,
}: SettingsRowProps) {
  const showChevron = onClick && !control;

  const content = (
    <>
      {Icon && (
        <Icon
          className={cn(
            'size-5 shrink-0',
            destructive
              ? 'text-[var(--destructive)]'
              : 'text-[var(--text-secondary)]',
          )}
        />
      )}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'settings-row-title',
            destructive && 'text-[var(--destructive)]',
          )}
        >
          {label}
        </div>
        {description && <div className="settings-row-desc">{description}</div>}
      </div>
      {control}
      {showChevron && (
        <ChevronRight className="size-4 shrink-0 text-[var(--text-tertiary)]" />
      )}
    </>
  );

  const shared = cn(
    'flex items-center gap-3 w-full py-3.5 text-left',
    border && 'border-b border-[var(--border-subtle)] last:border-b-0',
    disabled && 'opacity-50 pointer-events-none',
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          shared,
          focusRing,
          'hover:bg-[var(--bg-hover)] -mx-2 px-2 rounded-[var(--radius-xs)] transition-colors',
        )}
      >
        {content}
      </button>
    );
  }

  return <div className={shared}>{content}</div>;
}
