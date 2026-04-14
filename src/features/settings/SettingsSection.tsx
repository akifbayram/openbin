import type { ReactNode } from 'react';
import { cn, sectionHeader } from '@/lib/utils';

interface SettingsSectionProps {
  label: string;
  description?: string;
  labelClassName?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function SettingsSection({
  label,
  description,
  labelClassName,
  children,
  action,
}: SettingsSectionProps) {
  return (
    <div className="mb-8">
      <div className={cn('flex items-center justify-between pb-2 border-b border-[var(--border-flat)]', description ? 'mb-1' : 'mb-3')}>
        <h3 className={cn(sectionHeader, labelClassName)}>{label}</h3>
        {action}
      </div>
      {description && (
        <p className="text-[var(--text-sm)] text-[var(--text-tertiary)] mb-3 mt-2">
          {description}
        </p>
      )}
      {children}
    </div>
  );
}
