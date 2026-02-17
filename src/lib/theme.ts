import { useSyncExternalStore } from 'react';
import { STORAGE_KEYS } from './storageKeys';

export type ThemePreference = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = STORAGE_KEYS.THEME;
const mq = window.matchMedia('(prefers-color-scheme: dark)');

function resolveFromSystem(): ResolvedTheme {
  return mq.matches ? 'dark' : 'light';
}

function getStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
  return 'auto';
}

function resolve(pref: ThemePreference): ResolvedTheme {
  return pref === 'auto' ? resolveFromSystem() : pref;
}

function applyToDOM(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
}

let currentPreference: ThemePreference = getStoredPreference();
let currentTheme: ResolvedTheme = resolve(currentPreference);
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

// Track system theme changes for auto mode
mq.addEventListener('change', () => {
  if (currentPreference !== 'auto') return;
  currentTheme = resolveFromSystem();
  applyToDOM(currentTheme);
  notify();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getThemeSnapshot() {
  return currentTheme;
}

function getPrefSnapshot() {
  return currentPreference;
}

function setThemePreference(pref: ThemePreference) {
  if (pref === currentPreference) return;
  currentPreference = pref;
  currentTheme = resolve(pref);
  applyToDOM(currentTheme);
  localStorage.setItem(STORAGE_KEY, pref);
  notify();
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot);
  const preference = useSyncExternalStore(subscribe, getPrefSnapshot);

  return { theme, preference, setThemePreference };
}

/** Cycle through Light → Dark → Auto for compact toggle buttons */
export function cycleThemePreference(current: ThemePreference): ThemePreference {
  if (current === 'light') return 'dark';
  if (current === 'dark') return 'auto';
  return 'light';
}
