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
});
