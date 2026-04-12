import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LocationUsageDay } from '@/types';
import { UsageHeatmap } from '../UsageHeatmap';

describe('UsageHeatmap', () => {
  it('monthly: renders 12 cells', () => {
    const { container } = render(
      <UsageHeatmap
        data={[{ date: '2026-03-01', count: 1 }]}
        year={2026}
        granularity="monthly"
        mode="per-bin"
      />,
    );
    const cells = container.querySelectorAll('[data-testid="usage-cell"]');
    expect(cells).toHaveLength(12);
  });

  it('weekly: renders 53 cells', () => {
    const { container } = render(
      <UsageHeatmap data={[]} year={2026} granularity="weekly" mode="per-bin" />,
    );
    const cells = container.querySelectorAll('[data-testid="usage-cell"]');
    expect(cells).toHaveLength(53);
  });

  it('daily: renders 365 or 366 cells for a year', () => {
    const { container } = render(
      <UsageHeatmap data={[]} year={2026} granularity="daily" mode="per-bin" />,
    );
    const cells = container.querySelectorAll('[data-testid="usage-cell"]');
    expect(cells.length).toBeGreaterThanOrEqual(365);
    expect(cells.length).toBeLessThanOrEqual(366);
  });

  it('applies intensity-3 background to active cells with high count', () => {
    const { container } = render(
      <UsageHeatmap
        data={[{ date: '2026-03-05', count: 10 }]}
        year={2026}
        granularity="daily"
        mode="per-bin"
      />,
    );
    const activeCell = container.querySelector('[data-intensity="3"]');
    expect(activeCell).not.toBeNull();
  });

  it('empty rendering when data has no dates in selected year', () => {
    const { container } = render(
      <UsageHeatmap
        data={[{ date: '2024-03-05', count: 10 }]}
        year={2026}
        granularity="monthly"
        mode="per-bin"
      />,
    );
    const activeCells = container.querySelectorAll('[data-intensity="3"]');
    expect(activeCells).toHaveLength(0);
  });

  it('aggregate mode: intensity uses binCount for daily view', () => {
    const { container } = render(
      <UsageHeatmap
        data={[{ date: '2026-03-05', binCount: 4, totalCount: 8 }] as LocationUsageDay[]}
        year={2026}
        granularity="daily"
        mode="aggregate"
      />,
    );
    const activeCell = container.querySelector('[data-intensity="3"]');
    expect(activeCell).not.toBeNull();
  });
});
