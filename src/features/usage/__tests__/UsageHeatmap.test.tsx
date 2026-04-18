import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UsageHeatmap } from '../UsageHeatmap';

describe('UsageHeatmap', () => {
  it('monthly: renders 12 cells', () => {
    const { container } = render(
      <UsageHeatmap
        data={[{ date: '2026-03-01', count: 1 }]}
        year={2026}
        granularity="monthly"
      />,
    );
    const cells = container.querySelectorAll('[data-testid="usage-cell"]');
    expect(cells).toHaveLength(12);
  });

  it('weekly: renders 53 cells', () => {
    const { container } = render(
      <UsageHeatmap data={[]} year={2026} granularity="weekly" />,
    );
    const cells = container.querySelectorAll('[data-testid="usage-cell"]');
    expect(cells).toHaveLength(53);
  });

  it('daily: renders 365 or 366 cells for a year', () => {
    const { container } = render(
      <UsageHeatmap data={[]} year={2026} granularity="daily" />,
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
      />,
    );
    const activeCells = container.querySelectorAll('[data-intensity="3"]');
    expect(activeCells).toHaveLength(0);
  });

  it('ignores malformed date entries without crashing', () => {
    const { container } = render(
      <UsageHeatmap
        data={[
          { date: 'garbage', count: 10 },
          { date: '2026-13-99', count: 10 },
          { date: '2026-03-05', count: 2 },
        ]}
        year={2026}
        granularity="daily"
      />,
    );
    // Exactly one active cell (the valid 2026-03-05 entry)
    const activeCells = container.querySelectorAll('[data-intensity="2"]');
    expect(activeCells.length).toBe(1);
  });

  it('falls back safely when year is NaN', () => {
    const { container } = render(
      <UsageHeatmap
        data={[{ date: '2026-03-05', count: 10 }]}
        year={Number.NaN}
        granularity="monthly"
      />,
    );
    // Renders 12 month cells without crashing
    const cells = container.querySelectorAll('[data-testid="usage-cell"]');
    expect(cells).toHaveLength(12);
  });

  it('exposes a role="img" with an aria-label for screen readers', () => {
    const { container } = render(
      <UsageHeatmap
        data={[{ date: '2026-03-05', count: 2 }]}
        year={2026}
        granularity="monthly"
      />,
    );
    const img = container.querySelector('[role="img"]');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('aria-label')).toContain('2026');
  });

  it('marks today with a highlight in daily view', () => {
    // Use the current year so the "today" cell actually falls within the grid.
    const currentYear = new Date().getUTCFullYear();
    const { container } = render(
      <UsageHeatmap data={[]} year={currentYear} granularity="daily" />,
    );
    const todayCells = container.querySelectorAll('[data-today="true"]');
    expect(todayCells.length).toBe(1);
  });

  it('does not mark any cell as today when viewing a past year', () => {
    const { container } = render(
      <UsageHeatmap data={[]} year={2020} granularity="daily" />,
    );
    const todayCells = container.querySelectorAll('[data-today="true"]');
    expect(todayCells.length).toBe(0);
  });

  it('formats the Jan 1 cell tooltip in UTC regardless of the host timezone', () => {
    const { container } = render(
      <UsageHeatmap
        data={[{ date: '2026-01-01', count: 1 }]}
        year={2026}
        granularity="daily"
        onDayClick={() => {}}
      />,
    );
    const janCell = container.querySelector('[data-intensity="1"]');
    expect(janCell).not.toBeNull();
    const label = janCell?.getAttribute('aria-label') ?? '';
    expect(label).toContain('2026');
    expect(label).not.toMatch(/Dec/i);
  });
});
