import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface UserPreferences {
  dashboard_recent_bins_count: number;
  dashboard_scan_history_max: number;
  dashboard_show_stats: boolean;
  dashboard_show_needs_organizing: boolean;
  dashboard_show_saved_views: boolean;
  dashboard_show_pinned_bins: boolean;
  dashboard_show_recently_scanned: boolean;
  dashboard_show_recently_updated: boolean;
  dashboard_show_activity: boolean;
  dashboard_show_timestamps: boolean;
  ai_enabled: boolean;
  onboarding_completed: boolean;
  onboarding_step: number;
  onboarding_location_id: string | null;
  tour_completed: boolean;
  tour_version: number;
  keyboard_shortcuts_enabled: boolean;
  checklist_dismissed: boolean;
  usage_tracking_scan: boolean;
  usage_tracking_manual_lookup: boolean;
  usage_tracking_view: boolean;
  usage_tracking_modify: boolean;
  usage_granularity: 'daily' | 'weekly' | 'monthly';
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  dashboard_recent_bins_count: 5,
  dashboard_scan_history_max: 20,
  dashboard_show_stats: false,
  dashboard_show_needs_organizing: true,
  dashboard_show_saved_views: true,
  dashboard_show_pinned_bins: true,
  dashboard_show_recently_scanned: true,
  dashboard_show_recently_updated: true,
  dashboard_show_activity: true,
  dashboard_show_timestamps: false,
  ai_enabled: true,
  onboarding_completed: false,
  onboarding_step: 0,
  onboarding_location_id: null,
  tour_completed: false,
  tour_version: 0,
  keyboard_shortcuts_enabled: true,
  checklist_dismissed: false,
  usage_tracking_scan: true,
  usage_tracking_manual_lookup: true,
  usage_tracking_view: false,
  usage_tracking_modify: false,
  usage_granularity: 'monthly',
};

const PREFERENCES_EVENT = 'user-preferences-changed';

export function notifyPreferencesChanged() {
  window.dispatchEvent(new Event(PREFERENCES_EVENT));
}

interface UserPreferencesContextValue {
  preferences: UserPreferences;
  isLoading: boolean;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const latestRef = useRef<UserPreferences>(preferences);

  latestRef.current = preferences;

  const debouncedSave = useCallback((next: UserPreferences) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      apiFetch('/api/user-preferences', { method: 'PUT', body: next })
        .catch((err) => console.error('Failed to save user preferences:', err));
    }, 500);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await apiFetch<UserPreferences | null>('/api/user-preferences');
        if (cancelled) return;
        if (data) {
          setPreferences({ ...DEFAULT_PREFERENCES, ...data });
        }
      } catch {
        // Network or server error — keep defaults
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    function onChanged() {
      apiFetch<UserPreferences | null>('/api/user-preferences')
        .then((data) => {
          if (!cancelled && data) setPreferences({ ...DEFAULT_PREFERENCES, ...data });
        })
        .catch(() => {});
    }

    window.addEventListener(PREFERENCES_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(PREFERENCES_EVENT, onChanged);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const updatePreferences = useCallback((patch: Partial<UserPreferences>) => {
    const next = { ...latestRef.current, ...patch };
    latestRef.current = next;
    setPreferences(next);
    debouncedSave(next);
  }, [debouncedSave]);

  const value = useMemo(
    () => ({ preferences, isLoading, updatePreferences }),
    [preferences, isLoading, updatePreferences],
  );

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) throw new Error('useUserPreferences must be used within UserPreferencesProvider');
  return ctx;
}
