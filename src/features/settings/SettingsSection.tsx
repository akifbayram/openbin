import type { ReactNode } from 'react';
import { categoryHeader, cn } from '@/lib/utils';

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
    <div className="mb-7">
      <div className="flex items-center justify-between mb-3">
        <h3 className={cn(categoryHeader, 'px-0', labelClassName)}>{label}</h3>
        {action}
      </div>
      {description && (
        <p className="text-[13px] text-[var(--text-tertiary)] mb-3 -mt-1">
          {description}
        </p>
      )}
      <div>{children}</div>
    </div>
  );
}
