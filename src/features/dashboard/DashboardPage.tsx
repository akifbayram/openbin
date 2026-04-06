import { Bookmark, ChevronRight, Clock, Inbox, MapPin, Package, Pin, Plus, Printer, QrCode, ScanLine, Sparkles } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { SavedViewChips } from '@/components/saved-view-chips';
import { Button } from '@/components/ui/button';
import { Crossfade } from '@/components/ui/crossfade';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { BinCard } from '@/features/bins/BinCard';
import { buildViewSearchParams } from '@/features/bins/useBinSearchParams';
import { useAllTags } from '@/features/bins/useBins';
import { useBulkActions } from '@/features/bins/useBulkActions';
import { useBulkDialogs } from '@/features/bins/useBulkDialogs';
import { useBulkSelection } from '@/features/bins/useBulkSelection';
import { useScanDialog } from '@/features/qrcode/ScanDialogContext';
import { getCommandInputRef } from '@/features/tour/TourProvider';
import { useAiEnabled } from '@/lib/aiToggle';
import { useAuth } from '@/lib/auth';
import { useDashboardSettings } from '@/lib/dashboardSettings';
import { formatTimeAgo } from '@/lib/formatTime';
import { deleteView, useSavedViews } from '@/lib/savedViews';
import { useTerminology } from '@/lib/terminology';
import { useDebounce } from '@/lib/useDebounce';
import { usePermissions } from '@/lib/usePermissions';
import { usePlan } from '@/lib/usePlan';
import { useUserPreferences } from '@/lib/userPreferences';
import { cn } from '@/lib/utils';
import type { Bin } from '@/types';
import { DashboardChecklist } from './DashboardChecklist';
import { DashboardDialogs } from './DashboardDialogs';
import { DashboardSettingsMenu } from './DashboardSettingsMenu';
import { DashboardSkeleton } from './DashboardSkeleton';
import { SectionHeader, StatCard } from './DashboardWidgets';
import { useDashboard } from './useDashboard';

const UpgradeDialog = __EE__
  ? lazy(() => import('@/ee/UpgradeDialog').then(m => ({ default: m.UpgradeDialog })))
  : (() => null) as React.FC<Record<string, unknown>>;

export function DashboardPage() {
  const t = useTerminology();
  const navigate = useNavigate();
  const { activeLocationId } = useAuth();
  const { openScanDialog } = useScanDialog();
  const { aiEnabled, aiGated } = useAiEnabled();
  const { isGated, isSelfHosted } = usePlan();
  const aiAvailable = aiEnabled && (isSelfHosted || !isGated('ai'));
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { showToast } = useToast();
  const { totalBins, totalItems, totalAreas, needsOrganizing, recentlyScanned, scanTimeMap, recentlyUpdated, pinnedBins, isLoading } =
    useDashboard();
  const { settings: dashSettings, updateSettings: updateDashSettings } = useDashboardSettings();
  const { preferences, updatePreferences } = useUserPreferences();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { views: savedViews } = useSavedViews();
  const [createOpen, setCreateOpen] = useState(false);

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
  const { bulkDelete, bulkPinToggle, bulkDuplicate, pinLabel, isBusy } = useBulkActions(allDashboardBins, selectedIds, clearSelection, showToast, t);

  const showChecklist = !preferences.checklist_dismissed && totalBins < 3 && totalBins > 0;

  const binIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < allDashboardBins.length; i++) map.set(allDashboardBins[i].id, i);
    return map;
  }, [allDashboardBins]);

  useEffect(() => {
    if (debouncedSearch.trim()) {
      navigate(`/bins?q=${encodeURIComponent(debouncedSearch.trim())}`);
    }
  }, [debouncedSearch, navigate]);

  if (!activeLocationId) {
    return (
      <div className="page-content-wide">
        <PageHeader title="Dashboard" />
        <EmptyState
          icon={MapPin}
          title={`No ${t.location} selected`}
          subtitle={`Create or join a ${t.location} to start organizing ${t.bins}`}
          variant="onboard"
        >
          <Button
            onClick={() => navigate('/locations')}
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
    <div className="page-content-wide">
      <PageHeader
        title="Dashboard"
        actions={
          <div className="row">
            <div className="flex items-center gap-1">
              <DashboardSettingsMenu settings={dashSettings} onUpdate={updateDashSettings} terminology={t} />
              <Tooltip content="Scan QR code" side="bottom">
                <Button
                  onClick={() => openScanDialog()}
                  size="icon"
                  variant="ghost"
                  className="hidden lg:inline-flex h-10 w-10 rounded-[var(--radius-sm)]"
                  aria-label="Scan QR code"
                >
                  <ScanLine className="h-5 w-5" />
                </Button>
              </Tooltip>
              {(aiAvailable || aiGated) && (
                <Tooltip content={`${/Mac|iPhone|iPad/.test(navigator.userAgent) ? '\u2318' : 'Ctrl+'}J`} side="bottom">
                  <Button
                    onClick={() => aiGated ? setUpgradeOpen(true) : getCommandInputRef().current?.open()}
                    variant="ghost"
                    size="sm"
                    className="hidden lg:inline-flex h-10 gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ai-accent)]/10 text-[var(--ai-accent)] hover:bg-[var(--ai-accent)]/15 active:bg-[var(--ai-accent)]/20 ai-shimmer"
                    aria-label="Ask AI"
                  >
                    <Sparkles className="h-4 w-4" />
                    Ask AI
                  </Button>
                </Tooltip>
              )}
            </div>
            {canCreateBin && (
              <Tooltip content={`New ${t.bin}`} side="bottom">
                <Button
                  onClick={() => setCreateOpen(true)}
                  size="icon"
                  className="h-10 w-10 rounded-[var(--radius-sm)]"
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
        aria-label={`Search ${t.bins}`}
        containerClassName="flex-1"
      />

      <Crossfade
        isLoading={isLoading}
        skeleton={<DashboardSkeleton settings={dashSettings} />}
      >
        {showChecklist && (
          <DashboardChecklist
            totalBins={totalBins}
            totalItems={totalItems}
            onDismiss={() => updatePreferences({ checklist_dismissed: true })}
          />
        )}

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
            className="rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] px-4 py-3 row-spread hover:brightness-[0.97] transition-colors duration-150"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-[var(--radius-xl)] bg-[var(--color-warning)]/15 flex items-center justify-center">
                <Inbox className="h-[18px] w-[18px] text-[var(--color-warning)]" />
              </div>
              <div className="text-left">
                <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {needsOrganizing} {needsOrganizing !== 1 ? t.bins : t.bin} need{needsOrganizing === 1 ? 's' : ''} organizing
                </p>
                <p className="text-[12px] text-[var(--text-tertiary)]">No tags, area, or items</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--color-warning)] opacity-60" />
          </button>
        )}

        {/* Saved Views */}
        {dashSettings.showSavedViews && savedViews.length > 0 && (
          <section aria-labelledby="dash-saved-views" className="flex flex-col gap-2">
          <SectionHeader id="dash-saved-views" icon={Bookmark} title="Saved Searches" />
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
          </section>
        )}

        {/* Pinned Bins */}
        {dashSettings.showPinnedBins && pinnedBins.length > 0 && (
          <section aria-labelledby="dash-pinned" className="flex flex-col gap-2">
            <SectionHeader id="dash-pinned" icon={Pin} title="Pinned" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pinnedBins.map((bin, i) => (
                <div key={bin.id} className="animate-card-stagger" style={{ '--stagger-index': i } as React.CSSProperties}>
                  <BinCard bin={bin} index={binIndexMap.get(bin.id) ?? 0} selectable={selectable} selected={selectedIds.has(bin.id)} onSelect={toggleSelect} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recently Scanned */}
        {dashSettings.showRecentlyScanned && recentlyScanned.length > 0 && (
          <section aria-labelledby="dash-scanned" className="flex flex-col gap-2">
            <SectionHeader id="dash-scanned" icon={ScanLine} title="Recently Scanned" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {recentlyScanned.map((bin, i) => (
                <div key={bin.id} className="flex flex-col gap-1 animate-card-stagger" style={{ '--stagger-index': i } as React.CSSProperties}>
                  <BinCard bin={bin} index={binIndexMap.get(bin.id) ?? 0} selectable={selectable} selected={selectedIds.has(bin.id)} onSelect={toggleSelect} />
                  {dashSettings.showTimestamps && scanTimeMap.has(bin.id) && (
                    <p className="text-[11px] text-[var(--text-tertiary)] px-1">{formatTimeAgo(scanTimeMap.get(bin.id) as string)}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recently Updated */}
        {dashSettings.showRecentlyUpdated && recentlyUpdated.length > 0 && (
          <section aria-labelledby="dash-updated" className={cn("flex flex-col gap-2", selectable && "pb-16")}>
            <SectionHeader
              id="dash-updated"
              icon={Clock}
              title="Recently Updated"
              action={{ label: `All ${t.Bins}`, onClick: () => navigate('/bins') }}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {recentlyUpdated.map((bin, i) => (
                <div key={bin.id} className="flex flex-col gap-1 animate-card-stagger" style={{ '--stagger-index': i } as React.CSSProperties}>
                  <BinCard bin={bin} index={binIndexMap.get(bin.id) ?? 0} selectable={selectable} selected={selectedIds.has(bin.id)} onSelect={toggleSelect} />
                  {dashSettings.showTimestamps && (
                    <p className="text-[11px] text-[var(--text-tertiary)] px-1">{formatTimeAgo(bin.updated_at)}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* First-run onboarding (0 bins) */}
        {totalBins === 0 && (
          <div className="flex flex-col items-center justify-center gap-6 py-16">
            <div className="h-20 w-20 rounded-[var(--radius-xl)] bg-[var(--accent)]/10 flex items-center justify-center">
              <Package aria-hidden className="h-10 w-10 text-[var(--accent)] opacity-80" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-[19px] font-semibold text-[var(--text-secondary)]">
                Get started with {t.Bins}
              </h3>
              <p className="text-[14px] text-[var(--text-tertiary)] max-w-xs mx-auto">
                Create your first {t.bin}, print a QR label, and scan it to find what's inside.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {canCreateBin && (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create {t.bin}
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate('/print')}>
                <Printer className="h-4 w-4 mr-2" />
                Print labels
              </Button>
              <Button variant="outline" onClick={() => openScanDialog()}>
                <QrCode className="h-4 w-4 mr-2" />
                Scan QR
              </Button>
            </div>
          </div>
        )}

        {/* Empty sections nudge (has bins but all sections disabled) */}
        {totalBins > 0 && !(
          (dashSettings.showNeedsOrganizing && needsOrganizing > 0) ||
          (dashSettings.showSavedViews && savedViews.length > 0) ||
          (dashSettings.showPinnedBins && pinnedBins.length > 0) ||
          (dashSettings.showRecentlyScanned && recentlyScanned.length > 0) ||
          (dashSettings.showRecentlyUpdated && recentlyUpdated.length > 0)
        ) && (
          <div className="flex flex-col items-center justify-center gap-4 py-6 text-[var(--text-tertiary)]">
            <div className="text-center space-y-1.5">
              <p className="text-[17px] font-semibold text-[var(--text-secondary)]">Your dashboard is empty</p>
              <p className="text-[13px]">Turn on sections to see your data</p>
            </div>
            <div className="w-full max-w-xs space-y-1">
              {([
                { key: 'showStats' as const, label: 'Stats' },
                { key: 'showNeedsOrganizing' as const, label: 'Needs Organizing' },
                { key: 'showSavedViews' as const, label: 'Saved Views' },
                { key: 'showPinnedBins' as const, label: `Pinned ${t.Bins}` },
                { key: 'showRecentlyScanned' as const, label: 'Recently Scanned' },
                { key: 'showRecentlyUpdated' as const, label: 'Recently Updated' },
              ]).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-2 px-3 rounded-[var(--radius-md)]">
                  <span className="text-[14px] text-[var(--text-primary)]">{label}</span>
                  <Switch
                    checked={dashSettings[key]}
                    onCheckedChange={(checked) => updateDashSettings({ [key]: checked })}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Crossfade>

      <DashboardDialogs
        createOpen={createOpen} setCreateOpen={setCreateOpen}
        bulk={bulk} selectedIds={selectedIds} clearSelection={clearSelection}
        allTags={allTags} selectable={selectable} isAdmin={isAdmin} canWrite={canWrite}
        bulkDelete={bulkDelete} bulkPinToggle={bulkPinToggle} bulkDuplicate={bulkDuplicate}
        pinLabel={pinLabel} isBusy={isBusy} bins={allDashboardBins} t={t}
      />

      {__EE__ && (
        <Suspense fallback={null}>
          <UpgradeDialog
            open={upgradeOpen}
            onOpenChange={setUpgradeOpen}
            feature="AI Features"
            description="AI-powered commands, analysis, and suggestions are available on the Pro plan."
          />
        </Suspense>
      )}
    </div>
  );
}
