import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { ListResponse } from '@/types';

export interface ScanEntry {
  binId: string;
  scannedAt: string;
}

interface ServerScanEntry {
  id: string;
  bin_id: string;
  scanned_at: string;
}

const SCAN_HISTORY_EVENT = 'scan-history-changed';

function notifyScanHistoryChanged() {
  window.dispatchEvent(new Event(SCAN_HISTORY_EVENT));
}

export async function recordScan(binId: string): Promise<void> {
  try {
    await apiFetch('/api/scan-history', {
      method: 'POST',
      body: { bin_id: binId },
    });
    notifyScanHistoryChanged();
  } catch {
    // ignore — non-critical
  }
}

export function useScanHistory(limit = 20) {
  const [history, setHistory] = useState<ScanEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(() => {
    apiFetch<ListResponse<ServerScanEntry>>(`/api/scan-history?limit=${limit}`)
      .then((data) => {
        setHistory(
          data.results.map((e) => ({ binId: e.bin_id, scannedAt: e.scanned_at })),
        );
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [limit]);

  useEffect(() => {
    fetch();

    function onChanged() {
      fetch();
    }

    window.addEventListener(SCAN_HISTORY_EVENT, onChanged);
    return () => window.removeEventListener(SCAN_HISTORY_EVENT, onChanged);
  }, [fetch]);

  return { history, isLoading };
}
