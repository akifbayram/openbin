import { useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useLocationList, updateLocation } from '@/features/locations/useLocations';

export interface AppSettings {
  appName: string;
  termBin: string;
  termLocation: string;
  termArea: string;
}

export function useAppSettings() {
  const { activeLocationId } = useAuth();
  const { locations, isLoading } = useLocationList();

  const activeLocation = locations.find((l) => l.id === activeLocationId);
  const settings: AppSettings = {
    appName: activeLocation?.app_name ?? 'OpenBin',
    termBin: activeLocation?.term_bin ?? '',
    termLocation: activeLocation?.term_location ?? '',
    termArea: activeLocation?.term_area ?? '',
  };

  useEffect(() => {
    document.title = settings.appName;
  }, [settings.appName]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    if (!activeLocationId) return;
    const payload: Record<string, string | number> = {};
    if (patch.appName !== undefined) payload.app_name = patch.appName || 'OpenBin';
    if (patch.termBin !== undefined) payload.term_bin = patch.termBin;
    if (patch.termLocation !== undefined) payload.term_location = patch.termLocation;
    if (patch.termArea !== undefined) payload.term_area = patch.termArea;
    if (Object.keys(payload).length > 0) {
      updateLocation(activeLocationId, payload);
    }
  }, [activeLocationId]);

  const resetSettings = useCallback(() => {
    if (activeLocationId) {
      updateLocation(activeLocationId, {
        app_name: 'OpenBin',
        term_bin: '',
        term_location: '',
        term_area: '',
      });
    }
  }, [activeLocationId]);

  return { settings, updateSettings, resetSettings, isLoading };
}
