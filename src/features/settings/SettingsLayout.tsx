import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn, focusRing } from '@/lib/utils';
import { SettingsCategoryList } from './SettingsCategoryList';
import { SettingsSidebar } from './SettingsSidebar';
import { SETTINGS_CATEGORIES } from './settingsCategories';
import { useSettingsCategories } from './useSettingsCategories';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export function SettingsLayout() {
  const isDesktop = useIsDesktop();
  const { mainCategories, adminCategories } = useSettingsCategories();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const isIndex = pathname === '/settings' || pathname === '/settings/';

  if (isDesktop && isIndex) {
    return <Navigate to="/settings/account" replace />;
  }

  const isWidePage = pathname.endsWith('/activity');

  if (isDesktop) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--safe-top))] -mb-8">
        <SettingsSidebar mainCategories={mainCategories} adminCategories={adminCategories} />
        <div className="flex-1 overflow-y-auto">
          <div className={cn('mx-auto px-8 py-6', isWidePage ? 'max-w-7xl' : 'max-w-2xl')}>
            <Outlet />
          </div>
        </div>
      </div>
    );
  }

  if (isIndex) {
    return <SettingsCategoryList mainCategories={mainCategories} adminCategories={adminCategories} />;
  }

  const lastSegment = pathname.split('/').filter(Boolean).pop();
  const currentCategory = SETTINGS_CATEGORIES.find((c) => c.path === lastSegment);

  // Sub-pages that live under a parent category (e.g. /settings/activity → Data)
  const SUB_PAGE_META: Record<string, { label: string; backTo: string }> = {
    activity: { label: 'Activity Log', backTo: '/settings/data' },
    trash: { label: 'Trash', backTo: '/settings/data' },
  };
  const subPage = lastSegment ? SUB_PAGE_META[lastSegment] : undefined;
  const pageLabel = currentCategory?.label ?? subPage?.label;
  const backTo = subPage?.backTo ?? '/settings';

  return (
    <div className="page-content">
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className={cn('flex size-11 items-center justify-center rounded-[var(--radius-xs)] -ml-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]', focusRing)}
          aria-label="Back to settings"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {pageLabel && (
          <h1 className="text-[var(--text-lg)] font-bold text-[var(--text-primary)]">{pageLabel}</h1>
        )}
      </div>
      <Outlet />
    </div>
  );
}
