import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SectionStatus = 'info' | 'warn' | 'danger';

interface SettingsSectionProps {
  label: string;
  description?: string;
  /** Optional status banner shown below the description. */
  status?: SectionStatus;
  /** Banner body when `status` is set. Falls back to `description` when omitted. */
  statusMessage?: ReactNode;
  /** Applies the status color to the section label too. */
  tintLabel?: boolean;
  labelClassName?: string;
  children: ReactNode;
  action?: ReactNode;
  /** Draw a horizontal divider above this section — use to separate logical
   *  groups of settings on a page. Spacing collapses into the normal section
   *  gap so the divider sits visually centered between sections. */
  dividerAbove?: boolean;
}

const STATUS_LABEL_CLASS: Record<SectionStatus, string> = {
  info: 'settings-section-status-info',
  warn: 'settings-section-status-warn',
  danger: 'settings-section-status-danger',
};

const STATUS_BANNER_CLASS: Record<SectionStatus, string> = {
  info: 'settings-section-banner-info',
  warn: 'settings-section-banner-warn',
  danger: 'settings-section-banner-danger',
};

export function SettingsSection({
  label,
  description,
  status,
  statusMessage,
  tintLabel,
  labelClassName,
  children,
  action,
  dividerAbove,
}: SettingsSectionProps) {
  const hasBanner = status && statusMessage !== undefined;
  const bottomMargin = description || hasBanner ? 'mb-1' : 'mb-3';

  return (
    <section
      className={cn(
        'mb-10',
        // Split the existing mb-10 gap from the previous section in half,
        // placing the divider at its visual center.
        dividerAbove && 'mt-[-20px] pt-5 border-t border-[var(--border-subtle)]',
      )}
    >
      <div className={cn('flex items-center justify-between gap-2', bottomMargin)}>
        <h3
          className={cn(
            'settings-section-label',
            tintLabel && status && STATUS_LABEL_CLASS[status],
            labelClassName,
          )}
        >
          {label}
        </h3>
        {action}
      </div>
      {description && <p className="settings-section-desc mb-3">{description}</p>}
      {hasBanner && (
        <div
          role={status === 'danger' || status === 'warn' ? 'alert' : undefined}
          className={cn('settings-section-banner mb-3', STATUS_BANNER_CLASS[status])}
        >
          {statusMessage}
        </div>
      )}
      {children}
    </section>
  );
}
