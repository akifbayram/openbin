import { d, query } from '../db.js';

export interface UsageTrackingPrefs {
  scan: boolean;
  manual_lookup: boolean;
  view: boolean;
  modify: boolean;
}

const DEFAULT_PREFS: UsageTrackingPrefs = {
  scan: true,
  manual_lookup: true,
  view: false,
  modify: true,
};

/**
 * Upsert today's usage row for a bin. One row per (bin, UTC date).
 * Fire-and-forget from callers' perspective — errors are swallowed since
 * usage tracking is observational and should never fail a request.
 */
export async function recordBinUsage(binId: string, userId: string | null): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);  // 'YYYY-MM-DD' UTC
    await query(
      `INSERT INTO bin_usage_days (bin_id, date, count, last_user_id, last_recorded_at)
       VALUES ($1, $2, 1, $3, ${d.now()})
       ON CONFLICT (bin_id, date) DO UPDATE SET
         count = bin_usage_days.count + 1,
         last_user_id = EXCLUDED.last_user_id,
         last_recorded_at = ${d.now()}`,
      [binId, today, userId],
    );
  } catch {
    // Swallow — usage tracking is non-critical. Callers should not have to handle errors.
  }
}

interface SettingsRow {
  settings: unknown;
}

function parseSettings(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Read the caller's usage tracking preferences from the user_preferences JSON.
 * Returns DEFAULT_PREFS if no row exists or JSON is malformed.
 */
export async function getUserUsageTrackingPrefs(userId: string): Promise<UsageTrackingPrefs> {
  const result = await query<SettingsRow>(
    'SELECT settings FROM user_preferences WHERE user_id = $1',
    [userId],
  );
  if (result.rows.length === 0) return { ...DEFAULT_PREFS };

  const settings = parseSettings(result.rows[0].settings);
  return {
    scan: typeof settings.usage_tracking_scan === 'boolean' ? settings.usage_tracking_scan : DEFAULT_PREFS.scan,
    manual_lookup: typeof settings.usage_tracking_manual_lookup === 'boolean' ? settings.usage_tracking_manual_lookup : DEFAULT_PREFS.manual_lookup,
    view: typeof settings.usage_tracking_view === 'boolean' ? settings.usage_tracking_view : DEFAULT_PREFS.view,
    modify: typeof settings.usage_tracking_modify === 'boolean' ? settings.usage_tracking_modify : DEFAULT_PREFS.modify,
  };
}
