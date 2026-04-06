import { NavLink, useNavigate } from 'react-router-dom';
import { categoryHeader, cn, focusRing } from '@/lib/utils';
import type { SettingsCategory } from './settingsCategories';

interface SettingsSidebarProps {
  mainCategories: SettingsCategory[];
  adminCategories: SettingsCategory[];
}

const itemBase =
  'flex items-center gap-2.5 rounded-[var(--radius-xs)] px-3 py-2 text-[14px] font-medium transition-colors';

export function SettingsSidebar({ mainCategories, adminCategories }: SettingsSidebarProps) {
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Settings"
      className="flex w-[220px] shrink-0 flex-col border-r border-[var(--border-flat)] bg-[var(--bg-input)]/50"
    >
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-[18px] font-bold text-[var(--text-primary)]">Settings</h1>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 px-2">
        {mainCategories.map((cat) => {
          const Icon = cat.icon;

          if (cat.external) {
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => navigate(cat.path)}
                className={cn(itemBase, focusRing, 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]')}
              >
                <Icon className="h-4 w-4 text-[var(--text-tertiary)]" />
                {cat.label}
              </button>
            );
          }

          return (
            <NavLink
              key={cat.id}
              to={`/settings/${cat.path}`}
              className={({ isActive }) =>
                cn(
                  itemBase,
                  focusRing,
                  isActive
                    ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
                )
              }
            >
              <Icon className="h-4 w-4 text-[var(--text-tertiary)]" />
              {cat.label}
            </NavLink>
          );
        })}
      </div>

      {adminCategories.length > 0 && (
        <div className="border-t border-[var(--border-subtle)] px-2 pt-3 pb-4">
          <span className={cn(categoryHeader, 'px-3 pb-1.5 block')}>Admin</span>
          <div className="flex flex-col gap-0.5">
            {adminCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => navigate(cat.path)}
                  className={cn(itemBase, focusRing, 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]')}
                >
                  <Icon className="h-4 w-4 text-[var(--text-tertiary)]" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
