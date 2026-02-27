import { useCallback } from 'react';
import { useUserPreferences } from '@/lib/userPreferences';

export const ONBOARDING_TOTAL_STEPS = 5;

export function useOnboarding() {
  const { preferences, isLoading, updatePreferences } = useUserPreferences();

  return {
    isOnboarding: isLoading ? false : !preferences.onboarding_completed,
    isLoading,
    step: preferences.onboarding_step,
    locationId: preferences.onboarding_location_id ?? undefined,
    firstScanDone: preferences.first_scan_done,
    advanceWithLocation: useCallback((id: string) => {
      updatePreferences({
        onboarding_location_id: id,
        onboarding_step: preferences.onboarding_step + 1,
      });
    }, [updatePreferences, preferences.onboarding_step]),
    advanceStep: useCallback(() => {
      const next = preferences.onboarding_step + 1;
      if (next >= ONBOARDING_TOTAL_STEPS) {
        updatePreferences({ onboarding_completed: true });
      } else {
        updatePreferences({ onboarding_step: next });
      }
    }, [updatePreferences, preferences.onboarding_step]),
    complete: useCallback(() => {
      updatePreferences({ onboarding_completed: true });
    }, [updatePreferences]),
    markFirstScanDone: useCallback(() => {
      updatePreferences({ first_scan_done: true });
    }, [updatePreferences]),
  };
}
