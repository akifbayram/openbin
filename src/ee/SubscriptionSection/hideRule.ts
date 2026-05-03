export interface MetricLimit {
  used: number;
  limit: number | null;
}

export function shouldHideMetric({ limit }: MetricLimit): boolean {
  if (limit === null) return true;
  if (limit === 0) return true;
  if (limit === 1) return true;
  return false;
}

export function tone(used: number, limit: number): 'neutral' | 'amber' | 'red' {
  if (limit <= 0) return 'neutral';
  const pct = (used / limit) * 100;
  if (pct >= 80) return 'red';
  if (pct >= 60) return 'amber';
  return 'neutral';
}
