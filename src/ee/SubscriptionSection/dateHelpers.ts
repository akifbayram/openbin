// UTC-pinned so a date-only ISO timestamp renders as the same calendar day in
// every viewer's timezone. Distinct from src/lib/utils.ts:formatDate, which is
// short-format and locale-zoned.
export function formatBillingDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 3600 * 1000));
}
