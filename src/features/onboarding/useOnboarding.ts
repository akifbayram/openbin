import { useCallback } from 'react';
import { useUserPreferences } from '@/lib/userPreferences';

export const ONBOARDING_TOTAL_STEPS = 3;
export const DEMO_ONBOARDING_TOTAL_STEPS = 4;

export function useOnboarding(demoMode?: boolean) {
  const { preferences, isLoading, updatePreferences } = useUserPreferences();
  const totalSteps = demoMode ? DEMO_ONBOARDING_TOTAL_STEPS : ONBOARDING_TOTAL_STEPS;

  return {
    isOnboarding: isLoading ? false : !preferences.onboarding_completed,
    isLoading,
    step: preferences.onboarding_step,
    totalSteps,
    locationId: preferences.onboarding_location_id ?? undefined,
    advanceWithLocation: useCallback((id: string) => {
      updatePreferences({
        onboarding_location_id: id,
        onboarding_step: preferences.onboarding_step + 1,
      });
    }, [updatePreferences, preferences.onboarding_step]),
    advanceStep: useCallback(() => {
      const next = preferences.onboarding_step + 1;
      if (next >= totalSteps) {
        updatePreferences({ onboarding_completed: true });
      } else {
        updatePreferences({ onboarding_step: next });
      }
    }, [updatePreferences, preferences.onboarding_step, totalSteps]),
    complete: useCallback(() => {
      updatePreferences({ onboarding_completed: true });
    }, [updatePreferences]),
  };
}
