import { useCallback } from 'react';
import type { UserPreferences } from './userPreferences';
import { DEFAULT_PREFERENCES, useUserPreferences } from './userPreferences';

export interface DashboardSettings {
  recentBinsCount: number;
  scanHistoryMax: number;
  showStats: boolean;
  showNeedsOrganizing: boolean;
  showSavedViews: boolean;
  showPinnedBins: boolean;
  showRecentlyScanned: boolean;
  showRecentlyUpdated: boolean;
}

export const DASHBOARD_LIMITS = {
  recentBinsCount: { min: 3, max: 20 },
  scanHistoryMax: { min: 5, max: 100 },
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

const DEFAULTS: DashboardSettings = {
  recentBinsCount: DEFAULT_PREFERENCES.dashboard_recent_bins_count,
  scanHistoryMax: DEFAULT_PREFERENCES.dashboard_scan_history_max,
  showStats: DEFAULT_PREFERENCES.dashboard_show_stats,
  showNeedsOrganizing: DEFAULT_PREFERENCES.dashboard_show_needs_organizing,
  showSavedViews: DEFAULT_PREFERENCES.dashboard_show_saved_views,
  showPinnedBins: DEFAULT_PREFERENCES.dashboard_show_pinned_bins,
  showRecentlyScanned: DEFAULT_PREFERENCES.dashboard_show_recently_scanned,
  showRecentlyUpdated: DEFAULT_PREFERENCES.dashboard_show_recently_updated,
};

export function getDashboardSettings(): DashboardSettings {
  return { ...DEFAULTS };
}

export function useDashboardSettings() {
  const { preferences, isLoading, updatePreferences } = useUserPreferences();

  const settings: DashboardSettings = {
    recentBinsCount: clamp(
      preferences.dashboard_recent_bins_count,
      DASHBOARD_LIMITS.recentBinsCount.min,
      DASHBOARD_LIMITS.recentBinsCount.max,
    ),
    scanHistoryMax: clamp(
      preferences.dashboard_scan_history_max,
      DASHBOARD_LIMITS.scanHistoryMax.min,
      DASHBOARD_LIMITS.scanHistoryMax.max,
    ),
    showStats: preferences.dashboard_show_stats,
    showNeedsOrganizing: preferences.dashboard_show_needs_organizing,
    showSavedViews: preferences.dashboard_show_saved_views,
    showPinnedBins: preferences.dashboard_show_pinned_bins,
    showRecentlyScanned: preferences.dashboard_show_recently_scanned,
    showRecentlyUpdated: preferences.dashboard_show_recently_updated,
  };

  const updateSettings = useCallback((patch: Partial<DashboardSettings>) => {
    const dbPatch: Partial<UserPreferences> = {};
    if (patch.recentBinsCount !== undefined) {
      dbPatch.dashboard_recent_bins_count = clamp(patch.recentBinsCount, DASHBOARD_LIMITS.recentBinsCount.min, DASHBOARD_LIMITS.recentBinsCount.max);
    }
    if (patch.scanHistoryMax !== undefined) {
      dbPatch.dashboard_scan_history_max = clamp(patch.scanHistoryMax, DASHBOARD_LIMITS.scanHistoryMax.min, DASHBOARD_LIMITS.scanHistoryMax.max);
    }
    if (patch.showStats !== undefined) dbPatch.dashboard_show_stats = patch.showStats;
    if (patch.showNeedsOrganizing !== undefined) dbPatch.dashboard_show_needs_organizing = patch.showNeedsOrganizing;
    if (patch.showSavedViews !== undefined) dbPatch.dashboard_show_saved_views = patch.showSavedViews;
    if (patch.showPinnedBins !== undefined) dbPatch.dashboard_show_pinned_bins = patch.showPinnedBins;
    if (patch.showRecentlyScanned !== undefined) dbPatch.dashboard_show_recently_scanned = patch.showRecentlyScanned;
    if (patch.showRecentlyUpdated !== undefined) dbPatch.dashboard_show_recently_updated = patch.showRecentlyUpdated;
    updatePreferences(dbPatch);
  }, [updatePreferences]);

  const resetSettings = useCallback(() => {
    updatePreferences({
      dashboard_recent_bins_count: DEFAULT_PREFERENCES.dashboard_recent_bins_count,
      dashboard_scan_history_max: DEFAULT_PREFERENCES.dashboard_scan_history_max,
      dashboard_show_stats: DEFAULT_PREFERENCES.dashboard_show_stats,
      dashboard_show_needs_organizing: DEFAULT_PREFERENCES.dashboard_show_needs_organizing,
      dashboard_show_saved_views: DEFAULT_PREFERENCES.dashboard_show_saved_views,
      dashboard_show_pinned_bins: DEFAULT_PREFERENCES.dashboard_show_pinned_bins,
      dashboard_show_recently_scanned: DEFAULT_PREFERENCES.dashboard_show_recently_scanned,
      dashboard_show_recently_updated: DEFAULT_PREFERENCES.dashboard_show_recently_updated,
    });
  }, [updatePreferences]);

  return { settings, isLoading, updateSettings, resetSettings };
}
