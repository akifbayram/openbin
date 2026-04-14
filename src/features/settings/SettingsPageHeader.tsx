import type { ReactNode } from 'react';

interface SettingsPageHeaderProps {
  title: string;
  description: string;
  /** Optional element rendered next to the title on desktop (e.g. SavedBadge). */
  action?: ReactNode;
}

/**
 * On mobile the title is hidden because SettingsLayout already renders it
 * next to the back button — only the description is shown.
 */
export function SettingsPageHeader({ title, description, action }: SettingsPageHeaderProps) {
  return (
    <div className="mb-6 max-lg:mb-1">
      <div className="hidden items-center gap-2 lg:flex">
        <h2 className="text-[var(--text-xl)] font-bold text-[var(--text-primary)]">{title}</h2>
        {action}
      </div>
      <p className="text-[var(--text-sm)] text-[var(--text-tertiary)]">{description}</p>
    </div>
  );
}
