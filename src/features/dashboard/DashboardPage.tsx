import { ChevronRight, Inbox, MapPin, Plus, ScanLine, Settings, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { SavedViewChips } from '@/components/saved-view-chips';
import { Button } from '@/components/ui/button';
import { Crossfade } from '@/components/ui/crossfade';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { BinCard } from '@/features/bins/BinCard';
import { buildViewSearchParams } from '@/features/bins/useBinSearchParams';
import { useAllTags } from '@/features/bins/useBins';
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
import { DashboardDialogs } from './DashboardDialogs';
import { DashboardSkeleton } from './DashboardSkeleton';
import { SectionHeader, StatCard } from './DashboardWidgets';
import { useDashboard } from './useDashboard';

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

  const { isAdmin, canWrite, canCreateBin } = usePermissions();
  const allTags = useAllTags();
  const bulk = useBulkDialogs();
  const { selectedIds, selectable, toggleSelect, clearSelection } = useBulkSelection(allDashboardBins, [activeLocationId]);
  const { bulkDelete, bulkPinToggle, bulkDuplicate, pinLabel } = useBulkActions(allDashboardBins, selectedIds, clearSelection, showToast, t);

  const binIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < allDashboardBins.length; i++) map.set(allDashboardBins[i].id, i);
    return map;
  }, [allDashboardBins]);

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
            className="mt-1"
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
          <div className="row">
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
            {canCreateBin && (
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
            )}
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
        skeleton={<DashboardSkeleton settings={dashSettings} />}
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
            className="glass-card rounded-[var(--radius-lg)] px-4 py-3 row-spread"
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
              className="mt-1"
            >
              <Settings className="h-4 w-4 mr-2" />
              Dashboard Settings
            </Button>
          </EmptyState>
        )}
      </Crossfade>

      <DashboardDialogs
        createOpen={createOpen} setCreateOpen={setCreateOpen}
        commandOpen={commandOpen} setCommandOpen={setCommandOpen}
        aiEnabled={aiEnabled}
        bulk={bulk} selectedIds={selectedIds} clearSelection={clearSelection}
        allTags={allTags} selectable={selectable} isAdmin={isAdmin} canWrite={canWrite}
        bulkDelete={bulkDelete} bulkPinToggle={bulkPinToggle} bulkDuplicate={bulkDuplicate}
        pinLabel={pinLabel} bins={allDashboardBins} t={t}
      />
    </div>
  );
}
