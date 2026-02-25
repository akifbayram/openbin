import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, MapPin, ChevronRight, Plus, Inbox, Sparkles, Search } from 'lucide-react';

const CommandInput = lazy(() => import('@/features/ai/CommandInput').then((m) => ({ default: m.CommandInput })));
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Crossfade } from '@/components/ui/crossfade';
import { useDebounce } from '@/lib/useDebounce';
import { useAuth } from '@/lib/auth';
import { useAiEnabled } from '@/lib/aiToggle';
import { useSavedViews, deleteView } from '@/lib/savedViews';
import { buildViewSearchParams } from '@/features/bins/useBinSearchParams';
import { SavedViewChips } from '@/components/saved-view-chips';
import { useDashboardSettings } from '@/lib/dashboardSettings';
import { useTerminology } from '@/lib/terminology';
import { useDashboard } from './useDashboard';
import { BinCard } from '@/features/bins/BinCard';
import { BinCreateDialog } from '@/features/bins/BinCreateDialog';
import { PageHeader } from '@/components/ui/page-header';

function useAnimatedNumber(target: number, duration = 400) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(target);
      return;
    }
    const start = display;
    const delta = target - start;
    if (delta === 0) return;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + delta * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // Only re-run when target changes, not display
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}

function StatCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const animatedValue = useAnimatedNumber(value);
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Card className="flex-1">
      <Wrapper
        className="w-full text-left"
        {...(onClick ? { onClick } : {})}
      >
        <CardContent className="py-3 px-4">
          <p className="text-[24px] font-bold text-[var(--text-primary)] leading-tight">
            {animatedValue}
          </p>
          <p className="text-[13px] text-[var(--text-tertiary)]">{label}</p>
        </CardContent>
      </Wrapper>
    </Card>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[17px] font-semibold text-[var(--text-primary)]">
        {title}
      </h2>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-0.5 text-[13px] font-medium text-[var(--accent)]"
        >
          {action.label}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function DashboardPage() {
  const t = useTerminology();
  const navigate = useNavigate();
  const { activeLocationId } = useAuth();
  const { aiEnabled } = useAiEnabled();
  const { totalBins, totalItems, totalAreas, needsOrganizing, recentlyScanned, recentlyUpdated, pinnedBins, isLoading } =
    useDashboard();
  const { settings: dashSettings } = useDashboardSettings();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { views: savedViews } = useSavedViews();
  const [createOpen, setCreateOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    if (debouncedSearch.trim()) {
      navigate(`/bins?q=${encodeURIComponent(debouncedSearch.trim())}`);
    }
  }, [debouncedSearch, navigate]);

  if (!activeLocationId) {
    return (
      <div className="page-content max-w-none">
        <PageHeader title="Dashboard" />
        <EmptyState
          icon={MapPin}
          title={`No ${t.location} selected`}
          subtitle={`Create or join a ${t.location} to start organizing ${t.bins}`}
        >
          <Button
            onClick={() => navigate('/locations')}
            variant="outline"
            className="rounded-[var(--radius-full)] mt-1"
          >
            <MapPin className="h-4 w-4 mr-2" />
            {`Manage ${t.Locations}`}
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="page-content max-w-none">
      <PageHeader
        title="Dashboard"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <Button
                onClick={() => navigate('/scan')}
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full"
                aria-label="Scan QR code"
              >
                <ScanLine className="h-5 w-5" />
              </Button>
              {aiEnabled && (
                <Button
                  onClick={() => setCommandOpen(true)}
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 rounded-full"
                  aria-label="Ask AI"
                >
                  <Sparkles className="h-5 w-5" />
                </Button>
              )}
            </div>
            <Button
              onClick={() => setCreateOpen(true)}
              size="icon"
              className="h-10 w-10 rounded-full"
              aria-label={`New ${t.bin}`}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        }
      />

      {/* Search */}
      <div className="flex flex-1 min-w-0 items-center gap-1.5 rounded-[var(--radius-full)] bg-[var(--bg-input)] px-3.5 min-h-10 py-1.5 focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:shadow-[0_0_0_4px_var(--accent-glow)] transition-all duration-200">
        <Search className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
        <input
          data-shortcut-search
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${t.bins}...`}
          className="flex-1 min-w-[80px] bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
        />
      </div>

      <Crossfade
        isLoading={isLoading}
        skeleton={
          <>
            {/* Stats skeleton */}
            {dashSettings.showStats && (
              <div className="flex gap-3">
                <div className="flex-1 glass-card rounded-[var(--radius-lg)] p-4">
                  <Skeleton className="h-7 w-12 mb-1" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex-1 glass-card rounded-[var(--radius-lg)] p-4">
                  <Skeleton className="h-7 w-12 mb-1" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            )}

            {/* Pinned Bins skeleton */}
            {dashSettings.showPinnedBins && (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-5 w-16" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[1, 2].map((i) => (
                    <Card key={i}>
                      <CardContent className="py-3 px-4 space-y-2">
                        <Skeleton className="h-5 w-2/3" />
                        <Skeleton className="h-4 w-1/2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Recently Updated skeleton */}
            {dashSettings.showRecentlyUpdated && (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-5 w-32" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardContent className="py-3 px-4 space-y-2">
                        <Skeleton className="h-5 w-2/3" />
                        <Skeleton className="h-4 w-1/2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        }
      >
        {/* Stats */}
        {dashSettings.showStats && (
          <div className="flex gap-3">
            <StatCard
              label={`Total ${t.Bins}`}
              value={totalBins}
              onClick={() => navigate('/bins')}
            />
            <StatCard label="Total Items" value={totalItems} />
            {totalAreas > 0 && (
              <StatCard
                label={t.Areas}
                value={totalAreas}
                onClick={() => navigate('/locations')}
              />
            )}
          </div>
        )}

        {/* Needs Organizing */}
        {dashSettings.showNeedsOrganizing && needsOrganizing > 0 && (
          <button
            onClick={() => navigate('/bins?needs_organizing=true')}
            className="glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Inbox className="h-[18px] w-[18px] text-amber-500" />
              </div>
              <div className="text-left">
                <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {needsOrganizing} {needsOrganizing !== 1 ? t.bins : t.bin} need{needsOrganizing === 1 ? 's' : ''} organizing
                </p>
                <p className="text-[12px] text-[var(--text-tertiary)]">No tags, area, or items</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)]" />
          </button>
        )}

        {/* Saved Views */}
        {dashSettings.showSavedViews && (
          <SavedViewChips
            views={savedViews}
            onApply={(view) => {
              const qs = buildViewSearchParams(view);
              navigate(qs ? `/bins?${qs}` : '/bins');
            }}
            onDelete={(viewId) => {
              deleteView(viewId).catch(() => {});
            }}
          />
        )}

        {/* Pinned Bins */}
        {dashSettings.showPinnedBins && pinnedBins.length > 0 && (
          <div className="flex flex-col gap-3">
            <SectionHeader title="Pinned" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pinnedBins.map((bin) => (
                <BinCard key={bin.id} bin={bin} />
              ))}
            </div>
          </div>
        )}

        {/* Recently Scanned */}
        {dashSettings.showRecentlyScanned && recentlyScanned.length > 0 && (
          <div className="flex flex-col gap-3">
            <SectionHeader title="Recently Scanned" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {recentlyScanned.map((bin) => (
                <BinCard key={bin.id} bin={bin} />
              ))}
            </div>
          </div>
        )}

        {/* Recently Updated */}
        {dashSettings.showRecentlyUpdated && recentlyUpdated.length > 0 && (
          <div className="flex flex-col gap-3">
            <SectionHeader
              title="Recently Updated"
              action={{ label: `All ${t.Bins}`, onClick: () => navigate('/bins') }}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {recentlyUpdated.map((bin) => (
                <BinCard key={bin.id} bin={bin} />
              ))}
            </div>
          </div>
        )}
      </Crossfade>

      <BinCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      {aiEnabled && (
        <Suspense fallback={null}>
          {commandOpen && <CommandInput open={commandOpen} onOpenChange={setCommandOpen} />}
        </Suspense>
      )}
    </div>
  );
}
