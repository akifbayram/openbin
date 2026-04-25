import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LabelThreshold } from '../ai-progress-bar';
import { AiProgressBar, resolveLabel } from '../ai-progress-bar';

const PHOTO_LABELS: LabelThreshold[] = [
  [0, 'Uploading photos...'],
  [15, 'Identifying items...'],
  [45, 'Generating details...'],
  [75, 'Almost done...'],
];

describe('resolveLabel', () => {
  it('returns first label when progress is 0', () => {
    expect(resolveLabel(0, PHOTO_LABELS)).toBe('Uploading photos...');
  });

  it('returns first label when progress is below second threshold', () => {
    expect(resolveLabel(10, PHOTO_LABELS)).toBe('Uploading photos...');
  });

  it('returns second label at exact threshold', () => {
    expect(resolveLabel(15, PHOTO_LABELS)).toBe('Identifying items...');
  });

  it('returns third label at 50%', () => {
    expect(resolveLabel(50, PHOTO_LABELS)).toBe('Generating details...');
  });

  it('returns last label at 90%', () => {
    expect(resolveLabel(90, PHOTO_LABELS)).toBe('Almost done...');
  });

  it('returns first label for empty array fallback', () => {
    expect(resolveLabel(50, [[0, 'Loading...']])).toBe('Loading...');
  });
});

describe('AiProgressBar labels prop', () => {
  it('renders the initial label from labels array when active', () => {
    render(<AiProgressBar active labels={PHOTO_LABELS} />);
    expect(screen.getByText('Uploading photos...')).toBeTruthy();
  });

  it('prefers labels prop over label prop', () => {
    render(<AiProgressBar active label="Static label" labels={PHOTO_LABELS} />);
    expect(screen.getByText('Uploading photos...')).toBeTruthy();
    expect(screen.queryByText('Static label')).toBeNull();
  });

  it('uses static label prop when labels is not provided', () => {
    render(<AiProgressBar active label="Extracting items..." />);
    expect(screen.getByText('Extracting items...')).toBeTruthy();
  });
});

describe('AiProgressBar showSparkles prop', () => {
  it('renders Sparkles icon by default while streaming', () => {
    const { container } = render(<AiProgressBar active label="Working" />);
    const sparkles = container.querySelector('.ai-thinking-pulse');
    expect(sparkles).toBeTruthy();
  });

  it('omits Sparkles icon when showSparkles is false', () => {
    const { container } = render(
      <AiProgressBar active showSparkles={false} label="Working" />,
    );
    const sparkles = container.querySelector('.ai-thinking-pulse');
    expect(sparkles).toBeNull();
  });

  it('still renders the check icon on complete when showSparkles is false', () => {
    const { container } = render(
      <AiProgressBar active complete showSparkles={false} label="Done" />,
    );
    // Check icon uses the success color class
    const check = container.querySelector('.text-\\[var\\(--color-success\\)\\]');
    expect(check).toBeTruthy();
  });
});
