import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { categoryHeader, cn, focusRing } from '@/lib/utils';
import type { SettingsCategory } from './settingsCategories';

interface SettingsCategoryListProps {
  mainCategories: SettingsCategory[];
  adminCategories: SettingsCategory[];
}

function CategoryRow({ cat, onClick }: { cat: SettingsCategory; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-[var(--radius-xs)] border-b border-[var(--border-subtle)] px-2 py-3 text-left transition-colors hover:bg-[var(--bg-hover)]',
        focusRing,
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[var(--text-md)] font-medium text-[var(--text-primary)]">{cat.label}</div>
        <div className="text-[var(--text-sm)] text-[var(--text-tertiary)]">{cat.description}</div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
    </button>
  );
}

export function SettingsCategoryList({ mainCategories, adminCategories }: SettingsCategoryListProps) {
  const navigate = useNavigate();

  return (
    <div className="page-content">
      <h1 className="mb-4 text-[var(--text-2xl)] font-bold text-[var(--text-primary)]">Settings</h1>

      <div className="flex flex-col">
        {mainCategories.map((cat) => (
          <CategoryRow
            key={cat.id}
            cat={cat}
            onClick={() => navigate(cat.external ? cat.path : `/settings/${cat.path}`)}
          />
        ))}
      </div>

      {adminCategories.length > 0 && (
        <div className="mt-6">
          <span className={cn(categoryHeader, 'mb-2 block')}>Admin</span>
          <div className="flex flex-col">
            {adminCategories.map((cat) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                onClick={() => navigate(cat.path)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
