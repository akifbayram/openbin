export function formatDate(iso: string): string {
  // Format in UTC so a date-only ISO timestamp (e.g. "2026-05-27T00:00:00Z")
  // renders as the same calendar day regardless of viewer's local timezone.
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
