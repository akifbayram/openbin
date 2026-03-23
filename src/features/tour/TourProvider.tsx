import { createContext, useCallback, useContext, useMemo } from 'react';
import type { CommandInputControl } from './useRegisterCommandInput';
import type { UseTourReturn } from './useTour';

interface TourContextValue {
  tour: UseTourReturn;
  registerCommandInputControl: (control: CommandInputControl | null) => void;
}

const TourReactContext = createContext<TourContextValue | null>(null);

// Module-level ref so AppLayout can read it when building TourContext callbacks
const commandInputRef: { current: CommandInputControl | null } = { current: null };

export function getCommandInputRef() {
  return commandInputRef;
}

interface TourProviderProps {
  tour: UseTourReturn;
  children: React.ReactNode;
}

export function TourProvider({ tour, children }: TourProviderProps) {
  const registerCommandInputControl = useCallback((control: CommandInputControl | null) => {
    commandInputRef.current = control;
  }, []);

  const value = useMemo(
    () => ({ tour, registerCommandInputControl }),
    [tour, registerCommandInputControl],
  );

  return (
    <TourReactContext.Provider value={value}>
      {children}
    </TourReactContext.Provider>
  );
}

export function useTourContext() {
  return useContext(TourReactContext);
}
