import { apiFetch } from '@/lib/api';
import { Events, notify } from '@/lib/eventBus';
import { useListData } from '@/lib/useListData';

export interface ScanEntry {
  binId: string;
  scannedAt: string;
}

function notifyScanHistoryChanged() {
  notify(Events.SCAN_HISTORY);
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

const transformScanEntries = (results: any[]): ScanEntry[] =>
  results.map((e) => ({ binId: e.bin_id, scannedAt: e.scanned_at }));

export function useScanHistory(limit = 20) {
  const { data: history, isLoading } = useListData<ScanEntry>(
    `/api/scan-history?limit=${limit}`,
    [Events.SCAN_HISTORY],
    transformScanEntries,
  );
  return { history, isLoading };
}
