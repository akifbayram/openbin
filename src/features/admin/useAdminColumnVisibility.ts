import { useCallback, useMemo, useState } from 'react';
import { STORAGE_KEYS } from '@/lib/storageKeys';

export type AdminFieldKey =
  | 'email' | 'role' | 'plan' | 'status'
  | 'bins' | 'locations' | 'storage' | 'created'
  | 'lastActive' | 'items' | 'photos' | 'scans30d'
  | 'aiCredits' | 'apiKeys' | 'apiRequests7d'
  | 'binPct' | 'storagePct' | 'binsCreated7d' | 'accountAge';

const DEFAULT_VISIBILITY: Record<AdminFieldKey, boolean> = {
  email: true, role: true, plan: true, status: true,
  bins: true, locations: true, storage: true, created: true,
  lastActive: false, items: false, photos: false, scans30d: false,
  aiCredits: false, apiKeys: false, apiRequests7d: false,
  binPct: false, storagePct: false, binsCreated7d: false, accountAge: false,
};

export const ADMIN_FIELD_LABELS: Record<AdminFieldKey, string> = {
  email: 'Email', role: 'Role', plan: 'Plan', status: 'Status',
  bins: 'Bins', locations: 'Locations', storage: 'Storage', created: 'Created',
  lastActive: 'Last Active', items: 'Items', photos: 'Photos', scans30d: 'Scans (30d)',
  aiCredits: 'AI Credits', apiKeys: 'API Keys', apiRequests7d: 'API Reqs (7d)',
  binPct: 'Bin %', storagePct: 'Storage %', binsCreated7d: 'New Bins (7d)', accountAge: 'Age',
};

export const TOGGLEABLE_FIELDS: AdminFieldKey[] = [
  'email', 'role', 'bins', 'locations', 'storage', 'created',
  'lastActive', 'items', 'photos', 'scans30d',
  'aiCredits', 'apiKeys', 'apiRequests7d',
  'binPct', 'storagePct', 'binsCreated7d', 'accountAge',
];

function readStored(): Record<AdminFieldKey, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ADMIN_COLUMN_VISIBILITY);
    if (!raw) return { ...DEFAULT_VISIBILITY };
    return { ...DEFAULT_VISIBILITY, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_VISIBILITY };
  }
}

export function useAdminColumnVisibility() {
  const [visibility, setVisibility] = useState<Record<AdminFieldKey, boolean>>(readStored);

  const toggleField = useCallback((field: AdminFieldKey) => {
    setVisibility((prev) => {
      const next = { ...prev, [field]: !prev[field] };
      localStorage.setItem(STORAGE_KEYS.ADMIN_COLUMN_VISIBILITY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isVisible = useCallback(
    (field: AdminFieldKey): boolean => visibility[field],
    [visibility],
  );

  const visibleCount = useMemo(
    () => TOGGLEABLE_FIELDS.filter((f) => visibility[f]).length,
    [visibility],
  );

  return { visibility, toggleField, isVisible, visibleCount };
}
