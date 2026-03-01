import { createContext, useCallback, useContext } from 'react';

interface DrawerContextValue {
  openDrawer: () => void;
  isOnboarding: boolean;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function useDrawer(): DrawerContextValue {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error('useDrawer must be used within DrawerProvider');
  return ctx;
}

interface DrawerProviderProps {
  isOnboarding: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}

export function DrawerProvider({ isOnboarding, onOpen, children }: DrawerProviderProps) {
  const openDrawer = useCallback(() => onOpen(), [onOpen]);
  return (
    <DrawerContext.Provider value={{ openDrawer, isOnboarding }}>
      {children}
    </DrawerContext.Provider>
  );
}
