import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QueueDots } from '../QueueDots';

describe('QueueDots', () => {
  it('returns null when total is 1', () => {
    const { container } = render(<QueueDots total={1} currentIndex={0} doneCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when total is 0', () => {
    const { container } = render(<QueueDots total={0} currentIndex={0} doneCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one dot per group when total >= 2', () => {
    const { container } = render(<QueueDots total={5} currentIndex={2} doneCount={2} />);
    const dots = container.querySelectorAll('[data-queue-dot]');
    expect(dots.length).toBe(5);
  });

  it('marks dots before the current index as done', () => {
    const { container } = render(<QueueDots total={5} currentIndex={2} doneCount={2} />);
    const dots = container.querySelectorAll('[data-queue-dot]');
    expect(dots[0].getAttribute('data-state')).toBe('done');
    expect(dots[1].getAttribute('data-state')).toBe('done');
  });

  it('marks the dot at currentIndex as current', () => {
    const { container } = render(<QueueDots total={5} currentIndex={2} doneCount={2} />);
    const dots = container.querySelectorAll('[data-queue-dot]');
    expect(dots[2].getAttribute('data-state')).toBe('current');
  });

  it('marks dots after the current index as pending', () => {
    const { container } = render(<QueueDots total={5} currentIndex={2} doneCount={2} />);
    const dots = container.querySelectorAll('[data-queue-dot]');
    expect(dots[3].getAttribute('data-state')).toBe('pending');
    expect(dots[4].getAttribute('data-state')).toBe('pending');
  });

  it('uses doneCount to mark already-reviewed groups beyond currentIndex as done', () => {
    // Use case: user navigated back from summary; current is 1 but groups 0,1,2,3 are all reviewed
    const { container } = render(<QueueDots total={5} currentIndex={1} doneCount={4} />);
    const dots = container.querySelectorAll('[data-queue-dot]');
    expect(dots[0].getAttribute('data-state')).toBe('done');
    expect(dots[1].getAttribute('data-state')).toBe('current');
    expect(dots[2].getAttribute('data-state')).toBe('done');
    expect(dots[3].getAttribute('data-state')).toBe('done');
    expect(dots[4].getAttribute('data-state')).toBe('pending');
  });

  it('applies an aria-label of "Bin {currentIndex+1} of {total}"', () => {
    const { container } = render(<QueueDots total={5} currentIndex={2} doneCount={2} />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('aria-label')).toBe('Bin 3 of 5');
  });

  it('uses the singular term in the aria-label when termBin is provided', () => {
    const { container } = render(
      <QueueDots total={3} currentIndex={0} doneCount={0} termBin="Box" />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('aria-label')).toBe('Box 1 of 3');
  });
});
