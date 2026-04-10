import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface BinShare {
  id: string;
  token: string;
  visibility: 'public' | 'unlisted';
  url: string | null;
  viewCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface SharedBin {
  name: string;
  area_name: string;
  items: Array<{ name: string; quantity: number | null }>;
  notes: string;
  tags: string[];
  icon: string;
  color: string;
  card_style: string;
  custom_fields: Record<string, string>;
  created_at: string;
  updated_at: string;
  photos: Array<{ id: string; filename: string }>;
  shareToken: string;
}

export function useBinShare(binId: string | undefined) {
  const [share, setShare] = useState<BinShare | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!binId) { setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    apiFetch<BinShare>(`/api/bins/${binId}/share`)
      .then((data) => { if (!cancelled) setShare(data); })
      .catch(() => { if (!cancelled) setShare(null); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [binId]);

  return { share, isLoading, setShare };
}

export async function createShare(binId: string, visibility: 'public' | 'unlisted', expiresAt?: string | null): Promise<BinShare> {
  return apiFetch<BinShare>(`/api/bins/${binId}/share`, {
    method: 'POST',
    body: { visibility, expiresAt: expiresAt || undefined },
  });
}

export async function revokeShare(binId: string): Promise<void> {
  await apiFetch(`/api/bins/${binId}/share`, { method: 'DELETE' });
}

export function useSharedBin(token: string | undefined) {
  const [bin, setBin] = useState<SharedBin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    apiFetch<SharedBin>(`/api/shared/${token}`)
      .then((data) => { if (!cancelled) setBin(data); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Not found'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  return { bin, isLoading, error };
}
