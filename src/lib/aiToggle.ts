import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'sanduk-ai-enabled';

function getStored(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'false') return false;
  return true; // default enabled
}

let current: boolean = getStored();
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

function setAiEnabled(value: boolean) {
  if (value === current) return;
  current = value;
  localStorage.setItem(STORAGE_KEY, String(value));
  notify();
}

export function useAiEnabled() {
  const aiEnabled = useSyncExternalStore(subscribe, getSnapshot);
  return { aiEnabled, setAiEnabled };
}
