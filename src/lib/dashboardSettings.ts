import { useState, useCallback } from 'react';

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

const STORAGE_KEY = 'sanduk-dashboard-settings';

const DEFAULTS: DashboardSettings = {
  recentBinsCount: 5,
  scanHistoryMax: 20,
  showStats: true,
  showNeedsOrganizing: true,
  showSavedViews: true,
  showPinnedBins: true,
  showRecentlyScanned: true,
  showRecentlyUpdated: true,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function loadSettings(): DashboardSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        recentBinsCount: clamp(
          parsed.recentBinsCount ?? DEFAULTS.recentBinsCount,
          DASHBOARD_LIMITS.recentBinsCount.min,
          DASHBOARD_LIMITS.recentBinsCount.max,
        ),
        scanHistoryMax: clamp(
          parsed.scanHistoryMax ?? DEFAULTS.scanHistoryMax,
          DASHBOARD_LIMITS.scanHistoryMax.min,
          DASHBOARD_LIMITS.scanHistoryMax.max,
        ),
        showStats: typeof parsed.showStats === 'boolean' ? parsed.showStats : true,
        showNeedsOrganizing: typeof parsed.showNeedsOrganizing === 'boolean' ? parsed.showNeedsOrganizing : true,
        showSavedViews: typeof parsed.showSavedViews === 'boolean' ? parsed.showSavedViews : true,
        showPinnedBins: typeof parsed.showPinnedBins === 'boolean' ? parsed.showPinnedBins : true,
        showRecentlyScanned: typeof parsed.showRecentlyScanned === 'boolean' ? parsed.showRecentlyScanned : true,
        showRecentlyUpdated: typeof parsed.showRecentlyUpdated === 'boolean' ? parsed.showRecentlyUpdated : true,
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

/** Read dashboard settings synchronously (for non-React contexts) */
export function getDashboardSettings(): DashboardSettings {
  return loadSettings();
}

export function useDashboardSettings() {
  const [settings, setSettings] = useState<DashboardSettings>(loadSettings);

  const updateSettings = useCallback((patch: Partial<DashboardSettings>) => {
    setSettings((prev) => {
      const next: DashboardSettings = {
        recentBinsCount: clamp(
          patch.recentBinsCount ?? prev.recentBinsCount,
          DASHBOARD_LIMITS.recentBinsCount.min,
          DASHBOARD_LIMITS.recentBinsCount.max,
        ),
        scanHistoryMax: clamp(
          patch.scanHistoryMax ?? prev.scanHistoryMax,
          DASHBOARD_LIMITS.scanHistoryMax.min,
          DASHBOARD_LIMITS.scanHistoryMax.max,
        ),
        showStats: patch.showStats ?? prev.showStats,
        showNeedsOrganizing: patch.showNeedsOrganizing ?? prev.showNeedsOrganizing,
        showSavedViews: patch.showSavedViews ?? prev.showSavedViews,
        showPinnedBins: patch.showPinnedBins ?? prev.showPinnedBins,
        showRecentlyScanned: patch.showRecentlyScanned ?? prev.showRecentlyScanned,
        showRecentlyUpdated: patch.showRecentlyUpdated ?? prev.showRecentlyUpdated,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSettings({ ...DEFAULTS });
  }, []);

  return { settings, updateSettings, resetSettings };
}
