import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhotoScanFrame } from '../PhotoScanFrame';

describe('PhotoScanFrame', () => {
  it('renders four corner brackets', () => {
    const { container } = render(<PhotoScanFrame />);
    expect(container.querySelectorAll('[data-bracket]').length).toBe(4);
  });

  it('renders the scan line', () => {
    const { container } = render(<PhotoScanFrame />);
    expect(container.querySelector('.ai-scan-line')).toBeTruthy();
  });

  it('hides decorative chrome from screen readers', () => {
    const { container } = render(<PhotoScanFrame />);
    container.querySelectorAll('[data-bracket]').forEach((el) => {
      expect(el.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('defaults to phase="scanning" when prop omitted', () => {
    const { container } = render(<PhotoScanFrame />);
    container.querySelectorAll('[data-bracket]').forEach((el) => {
      expect(el.getAttribute('data-phase')).toBe('scanning');
    });
    expect(container.querySelector('.ai-scan-line')?.getAttribute('data-phase')).toBe('scanning');
  });

  it('applies data-phase="locking" to brackets and scan line when phase="locking"', () => {
    const { container } = render(<PhotoScanFrame phase="locking" />);
    container.querySelectorAll('[data-bracket]').forEach((el) => {
      expect(el.getAttribute('data-phase')).toBe('locking');
    });
    expect(container.querySelector('.ai-scan-line')?.getAttribute('data-phase')).toBe('locking');
  });

  it('exposes data-bracket="<position>" on each corner', () => {
    const { container } = render(<PhotoScanFrame />);
    const positions = Array.from(container.querySelectorAll('[data-bracket]')).map((el) =>
      el.getAttribute('data-bracket'),
    );
    expect(positions.sort()).toEqual(['bl', 'br', 'tl', 'tr']);
  });
});
