import { useCallback } from 'react';
import { useUserPreferences } from './userPreferences';

export function useAiEnabled() {
  const { preferences, isLoading, updatePreferences } = useUserPreferences();
  const setAiEnabled = useCallback(
    (value: boolean) => updatePreferences({ ai_enabled: value }),
    [updatePreferences],
  );
  return { aiEnabled: preferences.ai_enabled, setAiEnabled, isLoading };
}
