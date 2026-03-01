import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { LocationsContext, updateLocation } from '@/features/locations/useLocations';
import { useAuth } from '@/lib/auth';

export interface AppSettings {
  appName: string;
  termBin: string;
  termLocation: string;
  termArea: string;
}

export function useAppSettings() {
  const { activeLocationId } = useAuth();
  const ctx = useContext(LocationsContext);
  const locations = ctx?.locations ?? [];
  const isLoading = ctx?.isLoading ?? false;
  const [pendingPatch, setPendingPatch] = useState<Partial<AppSettings> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingPayloadRef = useRef<Record<string, string | number>>({});

  const activeLocation = locations.find((l) => l.id === activeLocationId);
  const serverSettings: AppSettings = {
    appName: activeLocation?.app_name ?? 'OpenBin',
    termBin: activeLocation?.term_bin ?? '',
    termLocation: activeLocation?.term_location ?? '',
    termArea: activeLocation?.term_area ?? '',
  };

  // Merge server state with any pending optimistic patch
  const settings: AppSettings = pendingPatch
    ? { ...serverSettings, ...pendingPatch }
    : serverSettings;

  useEffect(() => {
    document.title = settings.appName;
  }, [settings.appName]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    if (!activeLocationId) return;

    // Build API payload from this patch
    const newFields: Record<string, string | number> = {};
    if (patch.appName !== undefined) newFields.app_name = patch.appName || 'OpenBin';
    if (patch.termBin !== undefined) newFields.term_bin = patch.termBin;
    if (patch.termLocation !== undefined) newFields.term_location = patch.termLocation;
    if (patch.termArea !== undefined) newFields.term_area = patch.termArea;
    if (Object.keys(newFields).length === 0) return;

    // Accumulate fields across rapid calls so nothing is lost
    pendingPayloadRef.current = { ...pendingPayloadRef.current, ...newFields };

    // Update optimistic local state immediately
    setPendingPatch((prev) => ({ ...prev, ...patch }));

    // Debounce the actual API call
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const payload = pendingPayloadRef.current;
      pendingPayloadRef.current = {};
      setPendingPatch(null);
      updateLocation(activeLocationId, payload);
    }, 500);
  }, [activeLocationId]);

  const resetSettings = useCallback(() => {
    if (!activeLocationId) return;
    // Cancel any pending debounced save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingPayloadRef.current = {};
    setPendingPatch(null);
    updateLocation(activeLocationId, {
      app_name: 'OpenBin',
      term_bin: '',
      term_location: '',
      term_area: '',
    });
  }, [activeLocationId]);

  return { settings, updateSettings, resetSettings, isLoading };
}
