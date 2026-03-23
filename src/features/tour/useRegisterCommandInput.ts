import { useEffect, useMemo } from 'react';
import { useTourContext } from './TourProvider';

export interface CommandInputControl {
  open: () => void;
  close: () => void;
}

/** Register a CommandInput open/close control with the tour system for the snap-to-create step. */
export function useRegisterCommandInput(setCommandOpen: (open: boolean) => void) {
  const tourCtx = useTourContext();
  const control = useMemo<CommandInputControl>(() => ({
    open: () => setCommandOpen(true),
    close: () => setCommandOpen(false),
  }), [setCommandOpen]);
  useEffect(() => {
    tourCtx?.registerCommandInputControl(control);
    return () => tourCtx?.registerCommandInputControl(null);
  }, [tourCtx, control]);
}
