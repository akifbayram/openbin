import { useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useLocationList, updateLocation } from '@/features/locations/useLocations';

export interface AppSettings {
  appName: string;
}

export function useAppSettings() {
  const { activeLocationId } = useAuth();
  const { locations, isLoading } = useLocationList();

  const activeLocation = locations.find((l) => l.id === activeLocationId);
  const settings: AppSettings = {
    appName: activeLocation?.app_name ?? 'OpenBin',
  };

  useEffect(() => {
    document.title = settings.appName;
  }, [settings.appName]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    if (activeLocationId && patch.appName !== undefined) {
      updateLocation(activeLocationId, { app_name: patch.appName || 'OpenBin' });
    }
  }, [activeLocationId]);

  const resetSettings = useCallback(() => {
    if (activeLocationId) {
      updateLocation(activeLocationId, { app_name: 'OpenBin' });
    }
  }, [activeLocationId]);

  return { settings, updateSettings, resetSettings, isLoading };
}
