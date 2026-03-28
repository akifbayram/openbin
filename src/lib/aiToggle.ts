import { useCallback } from 'react';
import { usePlan } from './usePlan';
import { useUserPreferences } from './userPreferences';

export function useAiEnabled() {
  const { preferences, isLoading, updatePreferences } = useUserPreferences();
  const { isGated, isSelfHosted } = usePlan();
  const aiGated = !isSelfHosted && isGated('ai');
  const setAiEnabled = useCallback(
    (value: boolean) => updatePreferences({ ai_enabled: value }),
    [updatePreferences],
  );
  return { aiEnabled: preferences.ai_enabled && !aiGated, setAiEnabled, isLoading };
}
