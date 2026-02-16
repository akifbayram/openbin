import { useState, useEffect, useRef, useCallback } from 'react';
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
  ai_enabled: boolean;
  onboarding_completed: boolean;
  onboarding_step: number;
  onboarding_location_id: string | null;
  first_scan_done: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  dashboard_recent_bins_count: 5,
  dashboard_scan_history_max: 20,
  dashboard_show_stats: true,
  dashboard_show_needs_organizing: true,
  dashboard_show_saved_views: true,
  dashboard_show_pinned_bins: true,
  dashboard_show_recently_scanned: true,
  dashboard_show_recently_updated: true,
  ai_enabled: true,
  onboarding_completed: false,
  onboarding_step: 0,
  onboarding_location_id: null,
  first_scan_done: false,
};

const PREFERENCES_EVENT = 'user-preferences-changed';

export function notifyPreferencesChanged() {
  window.dispatchEvent(new Event(PREFERENCES_EVENT));
}

export function useUserPreferences() {
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

  return { preferences, isLoading, updatePreferences };
}
