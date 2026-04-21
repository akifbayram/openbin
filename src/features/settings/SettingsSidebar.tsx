import { NavLink, useNavigate } from 'react-router-dom';
import { cn, focusRing } from '@/lib/utils';
import type { SettingsCategory } from './settingsCategories';

interface SettingsSidebarProps {
  mainCategories: SettingsCategory[];
  adminCategories: SettingsCategory[];
}

const itemBase =
  'flex items-center rounded-[var(--radius-sm)] px-3 py-2 text-[var(--text-base)] font-medium transition-colors';

const itemActive = 'bg-[var(--bg-hover)] text-[var(--text-primary)]';

const itemIdle =
  'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]';

export function SettingsSidebar({ mainCategories, adminCategories }: SettingsSidebarProps) {
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Settings"
      className="flex w-[232px] shrink-0 flex-col overflow-y-auto"
    >
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-heading text-[24px] font-bold leading-none tracking-[-0.02em] text-[var(--text-primary)]">
          Settings
        </h1>
      </div>

      {adminCategories.length > 0 && (
        <div className="flex flex-col gap-0.5 px-2 pb-3 mb-3 border-b border-[var(--border-subtle)]">
          {adminCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => navigate(cat.path)}
              className={cn(itemBase, focusRing, itemIdle)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-0.5 px-2 pb-4">
        {mainCategories.map((cat) => {
          if (cat.external) {
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => navigate(cat.path)}
                className={cn(itemBase, focusRing, itemIdle)}
              >
                {cat.label}
              </button>
            );
          }

          return (
            <NavLink
              key={cat.id}
              to={`/settings/${cat.path}`}
              className={({ isActive }) =>
                cn(itemBase, focusRing, isActive ? itemActive : itemIdle)
              }
            >
              {cat.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
