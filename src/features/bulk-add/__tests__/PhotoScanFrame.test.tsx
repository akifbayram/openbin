import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhotoScanFrame } from '../PhotoScanFrame';

describe('PhotoScanFrame', () => {
  it('renders its children', () => {
    const { getByTestId } = render(
      <PhotoScanFrame itemCount={0}>
        <div data-testid="photo-content" />
      </PhotoScanFrame>,
    );
    expect(getByTestId('photo-content')).toBeTruthy();
  });

  it('renders four corner brackets', () => {
    const { container } = render(
      <PhotoScanFrame itemCount={0}>
        <div />
      </PhotoScanFrame>,
    );
    expect(container.querySelectorAll('[data-bracket]').length).toBe(4);
  });

  it('renders the scan line', () => {
    const { container } = render(
      <PhotoScanFrame itemCount={0}>
        <div />
      </PhotoScanFrame>,
    );
    expect(container.querySelector('.ai-scan-line')).toBeTruthy();
  });

  it('shows "SCANNING" readout when itemCount is 0', () => {
    const { getByText } = render(
      <PhotoScanFrame itemCount={0}>
        <div />
      </PhotoScanFrame>,
    );
    expect(getByText('SCANNING')).toBeTruthy();
  });

  it('shows "FOUND 1" readout when itemCount is 1', () => {
    const { getByText } = render(
      <PhotoScanFrame itemCount={1}>
        <div />
      </PhotoScanFrame>,
    );
    expect(getByText('FOUND 1')).toBeTruthy();
  });

  it('shows "FOUND 4" readout when itemCount is 4', () => {
    const { getByText } = render(
      <PhotoScanFrame itemCount={4}>
        <div />
      </PhotoScanFrame>,
    );
    expect(getByText('FOUND 4')).toBeTruthy();
  });

  it('marks the root with data-photo-scan-frame', () => {
    const { container } = render(
      <PhotoScanFrame itemCount={0}>
        <div />
      </PhotoScanFrame>,
    );
    expect(container.querySelector('[data-photo-scan-frame]')).toBeTruthy();
  });

  it('hides decorative chrome from screen readers', () => {
    const { container } = render(
      <PhotoScanFrame itemCount={0}>
        <div />
      </PhotoScanFrame>,
    );
    container.querySelectorAll('[data-bracket]').forEach((el) => {
      expect(el.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('defaults to phase="scanning" when prop omitted', () => {
    const { container } = render(
      <PhotoScanFrame itemCount={0}>
        <div />
      </PhotoScanFrame>,
    );
    container.querySelectorAll('[data-bracket]').forEach((el) => {
      expect(el.getAttribute('data-phase')).toBe('scanning');
    });
    expect(container.querySelector('.ai-scan-line')?.getAttribute('data-phase')).toBe('scanning');
  });

  it('applies data-phase="locking" to brackets and scan line when phase="locking"', () => {
    const { container } = render(
      <PhotoScanFrame itemCount={4} phase="locking">
        <div />
      </PhotoScanFrame>,
    );
    container.querySelectorAll('[data-bracket]').forEach((el) => {
      expect(el.getAttribute('data-phase')).toBe('locking');
    });
    expect(container.querySelector('.ai-scan-line')?.getAttribute('data-phase')).toBe('locking');
  });

  it('renders the LOCKED readout when phase="locking"', () => {
    const { getByText } = render(
      <PhotoScanFrame itemCount={4} phase="locking">
        <div />
      </PhotoScanFrame>,
    );
    expect(getByText('LOCKED')).toBeTruthy();
  });

  it('still renders the FOUND readout alongside LOCKED during phase="locking" (for crossfade)', () => {
    const { getByText } = render(
      <PhotoScanFrame itemCount={4} phase="locking">
        <div />
      </PhotoScanFrame>,
    );
    // Both readouts mount during locking — CSS handles the opacity crossfade.
    expect(getByText('FOUND 4')).toBeTruthy();
    expect(getByText('LOCKED')).toBeTruthy();
  });

  it('does not render the LOCKED readout when phase="scanning"', () => {
    const { queryByText } = render(
      <PhotoScanFrame itemCount={4} phase="scanning">
        <div />
      </PhotoScanFrame>,
    );
    expect(queryByText('LOCKED')).toBeNull();
  });

  it('exposes data-bracket="<position>" on each corner', () => {
    const { container } = render(
      <PhotoScanFrame itemCount={0}>
        <div />
      </PhotoScanFrame>,
    );
    const positions = Array.from(container.querySelectorAll('[data-bracket]')).map((el) =>
      el.getAttribute('data-bracket'),
    );
    expect(positions.sort()).toEqual(['bl', 'br', 'tl', 'tr']);
  });
});
