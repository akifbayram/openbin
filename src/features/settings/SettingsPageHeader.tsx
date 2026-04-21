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
    <header className="mb-8 max-lg:mb-2">
      <div className="hidden items-end justify-between gap-3 lg:flex">
        <h2 className="settings-page-title">{title}</h2>
        {action}
      </div>
      <p className="settings-page-desc lg:mt-2.5">{description}</p>
    </header>
  );
}
