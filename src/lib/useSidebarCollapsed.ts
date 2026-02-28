import { useSyncExternalStore } from 'react';
import { STORAGE_KEYS } from './storageKeys';

const STORAGE_KEY = STORAGE_KEYS.SIDEBAR_COLLAPSED;

function getStoredValue(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1';
}

let current = getStoredValue();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() {
  return current;
}

export function toggleSidebarCollapsed() {
  current = !current;
  localStorage.setItem(STORAGE_KEY, current ? '1' : '0');
  notify();
}

export function useSidebarCollapsed() {
  const isCollapsed = useSyncExternalStore(subscribe, getSnapshot);
  return { isCollapsed, toggle: toggleSidebarCollapsed };
}
