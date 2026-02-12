import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';

const STORAGE_PREFIX = 'sanduk-onboarding-';

interface OnboardingData {
  completed: boolean;
  step: number;
  locationId?: string;
}

function getKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function read(userId: string): OnboardingData {
  try {
    const raw = localStorage.getItem(getKey(userId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { completed: false, step: 0 };
}

function write(userId: string, data: OnboardingData) {
  localStorage.setItem(getKey(userId), JSON.stringify(data));
}

export function useOnboarding() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [data, setData] = useState<OnboardingData>(() => read(userId));

  const update = useCallback((updater: (prev: OnboardingData) => OnboardingData) => {
    setData((prev) => {
      const next = updater(prev);
      if (userId) write(userId, next);
      return next;
    });
  }, [userId]);

  return {
    isOnboarding: !data.completed,
    step: data.step,
    locationId: data.locationId,
    advanceWithLocation: useCallback((id: string) => {
      update((prev) => ({ ...prev, locationId: id, step: prev.step + 1 }));
    }, [update]),
    complete: useCallback(() => {
      update((prev) => ({ ...prev, completed: true }));
    }, [update]),
  };
}

/** Check if user has completed their first scan */
export function isFirstScanDone(userId: string): boolean {
  return localStorage.getItem(`sanduk-first-scan-done-${userId}`) === '1';
}

/** Mark first scan as done */
export function markFirstScanDone(userId: string) {
  localStorage.setItem(`sanduk-first-scan-done-${userId}`, '1');
}
