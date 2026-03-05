import { ChevronRight, Inbox, MapPin, Plus, ScanLine, Settings, Sparkles } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CommandInput = lazy(() => import('@/features/ai/CommandInput').then((m) => ({ default: m.CommandInput })));

import { SavedViewChips } from '@/components/saved-view-chips';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Crossfade } from '@/components/ui/crossfade';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { BinCard } from '@/features/bins/BinCard';
import { BinCreateDialog } from '@/features/bins/BinCreateDialog';
import { BulkActionBar } from '@/features/bins/BulkActionBar';
import { BulkAppearanceDialog } from '@/features/bins/BulkAppearanceDialog';
import { BulkAreaDialog } from '@/features/bins/BulkAreaDialog';
import { BulkCustomFieldsDialog } from '@/features/bins/BulkCustomFieldsDialog';
import { BulkLocationDialog } from '@/features/bins/BulkLocationDialog';
import { BulkTagDialog } from '@/features/bins/BulkTagDialog';
import { BulkVisibilityDialog } from '@/features/bins/BulkVisibilityDialog';
import { DeleteBinDialog } from '@/features/bins/DeleteBinDialog';
import { buildViewSearchParams } from '@/features/bins/useBinSearchParams';
import { updateBin, useAllTags } from '@/features/bins/useBins';
import { useBulkActions } from '@/features/bins/useBulkActions';
import { useBulkDialogs } from '@/features/bins/useBulkDialogs';
import { useBulkSelection } from '@/features/bins/useBulkSelection';
import { useScanDialog } from '@/features/qrcode/ScanDialogContext';
import { useAiEnabled } from '@/lib/aiToggle';
import { useAuth } from '@/lib/auth';
import { useDashboardSettings } from '@/lib/dashboardSettings';
import { deleteView, useSavedViews } from '@/lib/savedViews';
import { useTerminology } from '@/lib/terminology';
import { useDebounce } from '@/lib/useDebounce';
import { usePermissions } from '@/lib/usePermissions';
import { cn } from '@/lib/utils';
import type { Bin } from '@/types';
import { useDashboard } from './useDashboard';

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
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(start + delta * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // Only re-run when target changes, not display
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <Card className="flex-1 shadow-none">
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
          type="button"
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
  const { openScanDialog } = useScanDialog();
  const { aiEnabled } = useAiEnabled();
  const { showToast } = useToast();
  const { totalBins, totalItems, totalAreas, needsOrganizing, recentlyScanned, recentlyUpdated, pinnedBins, isLoading } =
    useDashboard();
  const { settings: dashSettings } = useDashboardSettings();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { views: savedViews } = useSavedViews();
  const [createOpen, setCreateOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  // Bulk selection
  const allDashboardBins = useMemo(() => {
    const seen = new Set<string>();
    const result: Bin[] = [];
    for (const bin of [...pinnedBins, ...recentlyScanned, ...recentlyUpdated]) {
      if (!seen.has(bin.id)) {
        seen.add(bin.id);
        result.push(bin);
      }
    }
    return result;
  }, [pinnedBins, recentlyScanned, recentlyUpdated]);

  const { isAdmin } = usePermissions();
  const allTags = useAllTags();
  const bulk = useBulkDialogs();
  const { selectedIds, selectable, toggleSelect, clearSelection } = useBulkSelection(allDashboardBins, [activeLocationId]);
  const { bulkDelete, bulkPinToggle, bulkDuplicate, pinLabel } = useBulkActions(allDashboardBins, selectedIds, clearSelection, showToast, t);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [copiedStyle, setCopiedStyle] = useState<{ icon: string; color: string; card_style: string } | null>(null);

  const binIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < allDashboardBins.length; i++) map.set(allDashboardBins[i].id, i);
    return map;
  }, [allDashboardBins]);

  const handleCopyStyle = useCallback(() => {
    const [id] = selectedIds;
    const bin = allDashboardBins.find((b) => b.id === id);
    if (!bin) return;
    setCopiedStyle({ icon: bin.icon, color: bin.color, card_style: bin.card_style });
    clearSelection();
    showToast({ message: 'Style copied' });
  }, [selectedIds, allDashboardBins, clearSelection, showToast]);

  const handlePasteStyle = useCallback(async () => {
    if (!copiedStyle) return;
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) => updateBin(id, { icon: copiedStyle.icon, color: copiedStyle.color, cardStyle: copiedStyle.card_style })));
    clearSelection();
    showToast({ message: `Style applied to ${ids.length} ${ids.length === 1 ? t.bin : t.bins}` });
  }, [copiedStyle, selectedIds, clearSelection, showToast, t]);

  useEffect(() => {
    if (sessionStorage.getItem('openbin-demo-toast')) return;
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.demoMode) {
          sessionStorage.setItem('openbin-demo-toast', '1');
          showToast({
            message: 'This is a demo — data resets periodically.',
            action: {
              label: 'Self-host',
              onClick: () => window.open('https://github.com/openbin-app/openbin', '_blank'),
            },
            duration: 8000,
          });
        }
      })
      .catch(() => {});
  }, [showToast]);

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
              <Tooltip content="Scan QR code" side="bottom">
                <Button
                  onClick={() => openScanDialog()}
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 rounded-full"
                  aria-label="Scan QR code"
                >
                  <ScanLine className="h-5 w-5" />
                </Button>
              </Tooltip>
              {aiEnabled && (
                <Tooltip content="Ask AI" side="bottom">
                  <Button
                    onClick={() => setCommandOpen(true)}
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-full"
                    aria-label="Ask AI"
                  >
                    <Sparkles className="h-5 w-5" />
                  </Button>
                </Tooltip>
              )}
            </div>
            <Tooltip content={`New ${t.bin}`} side="bottom">
              <Button
                onClick={() => setCreateOpen(true)}
                size="icon"
                className="h-10 w-10 rounded-full"
                aria-label={`New ${t.bin}`}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </Tooltip>
          </div>
        }
      />

      {/* Search */}
      <SearchInput
        data-shortcut-search
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${t.bins}...`}
        containerClassName="flex-1"
      />

      <Crossfade
        isLoading={isLoading}
        skeleton={
          <>
            {/* Stats skeleton */}
            {dashSettings.showStats && (
              <div className="flex gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex-1 glass-card rounded-[var(--radius-lg)] p-4">
                    <Skeleton className="h-7 w-12 mb-1" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
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
            type="button"
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
        {dashSettings.showSavedViews && savedViews.length > 0 && (
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
                <BinCard key={bin.id} bin={bin} index={binIndexMap.get(bin.id)} selectable={selectable} selected={selectedIds.has(bin.id)} onSelect={toggleSelect} />
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
                <BinCard key={bin.id} bin={bin} index={binIndexMap.get(bin.id)} selectable={selectable} selected={selectedIds.has(bin.id)} onSelect={toggleSelect} />
              ))}
            </div>
          </div>
        )}

        {/* Recently Updated */}
        {dashSettings.showRecentlyUpdated && recentlyUpdated.length > 0 && (
          <div className={cn("flex flex-col gap-3", selectable && "pb-16")}>
            <SectionHeader
              title="Recently Updated"
              action={{ label: `All ${t.Bins}`, onClick: () => navigate('/bins') }}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {recentlyUpdated.map((bin) => (
                <BinCard key={bin.id} bin={bin} index={binIndexMap.get(bin.id)} selectable={selectable} selected={selectedIds.has(bin.id)} onSelect={toggleSelect} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state nudge */}
        {!(
          (dashSettings.showNeedsOrganizing && needsOrganizing > 0) ||
          (dashSettings.showSavedViews && savedViews.length > 0) ||
          (dashSettings.showPinnedBins && pinnedBins.length > 0) ||
          (dashSettings.showRecentlyScanned && recentlyScanned.length > 0) ||
          (dashSettings.showRecentlyUpdated && recentlyUpdated.length > 0)
        ) && (
          <EmptyState
            icon={Settings}
            title="Your dashboard is empty"
            subtitle="Choose which sections to display in settings"
            compact
          >
            <Button
              onClick={() => navigate('/settings#dashboard-settings')}
              variant="outline"
              className="rounded-[var(--radius-full)] mt-1"
            >
              <Settings className="h-4 w-4 mr-2" />
              Dashboard Settings
            </Button>
          </EmptyState>
        )}
      </Crossfade>

      <BinCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      {aiEnabled && (
        <Suspense fallback={null}>
          {commandOpen && <CommandInput open={commandOpen} onOpenChange={setCommandOpen} />}
        </Suspense>
      )}

      {/* Bulk selection */}
      {selectable && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          isAdmin={isAdmin}
          onTag={() => bulk.open('tag')}
          onMove={() => bulk.open('area')}
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={clearSelection}
          onAppearance={() => bulk.open('appearance')}
          onVisibility={() => bulk.open('visibility')}
          onMoveLocation={() => bulk.open('location')}
          onPin={bulkPinToggle}
          onDuplicate={bulkDuplicate}
          pinLabel={pinLabel}
          onCustomFields={() => bulk.open('customFields')}
          onCopyStyle={handleCopyStyle}
          onPasteStyle={handlePasteStyle}
          canCopyStyle={selectedIds.size === 1}
          canPasteStyle={copiedStyle !== null}
        />
      )}
      <BulkTagDialog open={bulk.isOpen('tag')} onOpenChange={(v) => v ? bulk.open('tag') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} allTags={allTags} />
      <BulkAreaDialog open={bulk.isOpen('area')} onOpenChange={(v) => v ? bulk.open('area') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} />
      <BulkAppearanceDialog open={bulk.isOpen('appearance')} onOpenChange={(v) => v ? bulk.open('appearance') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} />
      <BulkVisibilityDialog open={bulk.isOpen('visibility')} onOpenChange={(v) => v ? bulk.open('visibility') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} />
      <BulkCustomFieldsDialog open={bulk.isOpen('customFields')} onOpenChange={(v) => v ? bulk.open('customFields') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} />
      <BulkLocationDialog open={bulk.isOpen('location')} onOpenChange={(v) => v ? bulk.open('location') : bulk.close()} binIds={[...selectedIds]} onDone={clearSelection} />
      <DeleteBinDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen} binName={`${selectedIds.size} ${selectedIds.size === 1 ? t.bin : t.bins}`} onConfirm={bulkDelete} />
    </div>
  );
}
