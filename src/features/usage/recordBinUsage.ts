import { apiFetch } from '@/lib/api';
import { Events, notify } from '@/lib/eventBus';

export type UsageTrigger = 'scan' | 'manual';

/**
 * Fire-and-forget POST to record a usage dot. Server enforces the caller's
 * preferences — returns `{ ok: true, recorded: boolean }`. If recording is
 * disabled in prefs, the POST still succeeds but writes nothing.
 * Any network failure is silently swallowed — usage tracking is non-critical.
 */
export async function recordBinUsage(binId: string, trigger: UsageTrigger): Promise<void> {
  try {
    const result = await apiFetch<{ ok: boolean; recorded: boolean }>(
      `/api/bins/${binId}/usage`,
      { method: 'POST', body: { trigger } },
    );
    if (result.recorded) notify(Events.BIN_USAGE);
  } catch {
    // Non-critical; swallow
  }
}
