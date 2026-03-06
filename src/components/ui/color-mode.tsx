import { useCallback, useSyncExternalStore } from 'react';
import { STORAGE_KEYS } from '@/lib/storageKeys';

export type ColorMode = 'light' | 'dark';
export type ColorModePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = STORAGE_KEYS.THEME;
const mq = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

function resolveFromSystem(): ColorMode {
  return mq?.matches ? 'dark' : 'light';
}

function getStoredPreference(): ColorModePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  // Backward compat: 'auto' was used in the old theme module
  if (stored === 'auto' || stored === 'system') return 'system';
  if (stored === 'light' || stored === 'dark') return stored;
  return 'system';
}

function resolve(pref: ColorModePreference): ColorMode {
  return pref === 'system' ? resolveFromSystem() : pref;
}

function applyToDOM(resolved: ColorMode) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
}

let currentPreference: ColorModePreference = getStoredPreference();
let currentColorMode: ColorMode = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const l of listeners) l();
}

// Track system theme changes for system mode
mq?.addEventListener('change', () => {
  if (currentPreference !== 'system') return;
  currentColorMode = resolveFromSystem();
  applyToDOM(currentColorMode);
  notifyListeners();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getColorModeSnapshot() {
  return currentColorMode;
}

function getPreferenceSnapshot() {
  return currentPreference;
}

function setColorModePreference(pref: ColorModePreference) {
  if (pref === currentPreference) return;
  currentPreference = pref;
  currentColorMode = resolve(pref);
  applyToDOM(currentColorMode);
  // Store 'system' (not 'auto') going forward
  localStorage.setItem(STORAGE_KEY, pref);
  notifyListeners();
}

export function useColorMode() {
  const colorMode = useSyncExternalStore(subscribe, getColorModeSnapshot);
  const preference = useSyncExternalStore(subscribe, getPreferenceSnapshot);

  const setColorMode = useCallback((mode: ColorModePreference) => {
    setColorModePreference(mode);
  }, []);

  const toggleColorMode = useCallback(() => {
    setColorModePreference(colorMode === 'light' ? 'dark' : 'light');
  }, [colorMode]);

  return { colorMode, preference, setColorMode, toggleColorMode };
}

export function useColorModeValue<T>(light: T, dark: T): T {
  const { colorMode } = useColorMode();
  return colorMode === 'dark' ? dark : light;
}

/** Cycle through Light -> Dark -> System for compact toggle buttons */
export function cycleColorMode(current: ColorModePreference): ColorModePreference {
  if (current === 'light') return 'dark';
  if (current === 'dark') return 'system';
  return 'light';
}
