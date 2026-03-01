import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useRef } from 'react';

interface NavigationGuard {
  /** Return true to block navigation */
  shouldBlock: () => boolean;
  /** Called when navigation is blocked. Call `proceed` to continue navigating. */
  onBlocked: (proceed: () => void) => void;
}

interface NavigationGuardContextValue {
  /** Register a guard. Returns an unregister function. */
  setGuard: (guard: NavigationGuard | null) => void;
  /** Navigate, but check the guard first. `action` performs the actual navigation. */
  guardedNavigate: (action: () => void) => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextValue>({
  setGuard: () => {},
  guardedNavigate: (action) => action(),
});

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const guardRef = useRef<NavigationGuard | null>(null);

  const setGuard = useCallback((guard: NavigationGuard | null) => {
    guardRef.current = guard;
  }, []);

  const guardedNavigate = useCallback((action: () => void) => {
    const guard = guardRef.current;
    if (guard?.shouldBlock()) {
      guard.onBlocked(action);
    } else {
      action();
    }
  }, []);

  return (
    <NavigationGuardContext.Provider value={{ setGuard, guardedNavigate }}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}
