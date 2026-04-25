import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhotoScanFrame } from '../PhotoScanFrame';

describe('PhotoScanFrame', () => {
  it('renders four corner brackets', () => {
    const { container } = render(<PhotoScanFrame itemCount={0} />);
    expect(container.querySelectorAll('[data-bracket]').length).toBe(4);
  });

  it('renders the scan line', () => {
    const { container } = render(<PhotoScanFrame itemCount={0} />);
    expect(container.querySelector('.ai-scan-line')).toBeTruthy();
  });

  it('shows "SCANNING" readout when itemCount is 0', () => {
    const { getByText } = render(<PhotoScanFrame itemCount={0} />);
    expect(getByText('SCANNING')).toBeTruthy();
  });

  it('shows "FOUND 1" readout when itemCount is 1', () => {
    const { getByText } = render(<PhotoScanFrame itemCount={1} />);
    expect(getByText('FOUND 1')).toBeTruthy();
  });

  it('shows "FOUND 4" readout when itemCount is 4', () => {
    const { getByText } = render(<PhotoScanFrame itemCount={4} />);
    expect(getByText('FOUND 4')).toBeTruthy();
  });

  it('hides decorative chrome from screen readers', () => {
    const { container } = render(<PhotoScanFrame itemCount={0} />);
    container.querySelectorAll('[data-bracket]').forEach((el) => {
      expect(el.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('defaults to phase="scanning" when prop omitted', () => {
    const { container } = render(<PhotoScanFrame itemCount={0} />);
    container.querySelectorAll('[data-bracket]').forEach((el) => {
      expect(el.getAttribute('data-phase')).toBe('scanning');
    });
    expect(container.querySelector('.ai-scan-line')?.getAttribute('data-phase')).toBe('scanning');
  });

  it('applies data-phase="locking" to brackets and scan line when phase="locking"', () => {
    const { container } = render(<PhotoScanFrame itemCount={4} phase="locking" />);
    container.querySelectorAll('[data-bracket]').forEach((el) => {
      expect(el.getAttribute('data-phase')).toBe('locking');
    });
    expect(container.querySelector('.ai-scan-line')?.getAttribute('data-phase')).toBe('locking');
  });

  it('renders the LOCKED readout when phase="locking"', () => {
    const { getByText } = render(<PhotoScanFrame itemCount={4} phase="locking" />);
    expect(getByText('LOCKED')).toBeTruthy();
  });

  it('still renders the FOUND readout alongside LOCKED during phase="locking" (for crossfade)', () => {
    const { getByText } = render(<PhotoScanFrame itemCount={4} phase="locking" />);
    // Both readouts mount during locking — CSS handles the opacity crossfade.
    expect(getByText('FOUND 4')).toBeTruthy();
    expect(getByText('LOCKED')).toBeTruthy();
  });

  it('does not render the LOCKED readout when phase="scanning"', () => {
    const { queryByText } = render(<PhotoScanFrame itemCount={4} phase="scanning" />);
    expect(queryByText('LOCKED')).toBeNull();
  });

  it('exposes data-bracket="<position>" on each corner', () => {
    const { container } = render(<PhotoScanFrame itemCount={0} />);
    const positions = Array.from(container.querySelectorAll('[data-bracket]')).map((el) =>
      el.getAttribute('data-bracket'),
    );
    expect(positions.sort()).toEqual(['bl', 'br', 'tl', 'tr']);
  });
});
