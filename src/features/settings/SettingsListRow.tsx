import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsListRowProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  border?: boolean;
}

export function SettingsListRow({
  icon: Icon,
  title,
  meta,
  action,
  border = true,
}: SettingsListRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 py-3.5',
        border && 'border-b border-[var(--border-subtle)] last:border-b-0',
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--bg-active)] flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-[var(--text-secondary)]" />
          </div>
        )}
        <div className="min-w-0">
          <p className="settings-list-title truncate">{title}</p>
          {meta && <p className="settings-list-meta">{meta}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
