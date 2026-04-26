import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiAnalyzeProgress } from '../AiAnalyzeProgress';

describe('AiAnalyzeProgress', () => {
  describe('label rendering by mode', () => {
    it('shows "Scanning" when mode=analyze and partialText is empty', () => {
      render(<AiAnalyzeProgress active mode="analyze" />);
      expect(screen.getByText(/^Scanning/)).toBeTruthy();
    });

    it('shows "Found 1 item" once one item has streamed', () => {
      render(
        <AiAnalyzeProgress
          active
          mode="analyze"
          partialText='{"name": "Box", "items": ["Hammer"'
        />,
      );
      expect(screen.getByText(/Found 1 item$/)).toBeTruthy();
    });

    it('shows "Reanalyzing" when mode=reanalyze with no items yet', () => {
      render(<AiAnalyzeProgress active mode="reanalyze" />);
      expect(screen.getByText(/^Reanalyzing/)).toBeTruthy();
    });

    it('shows "Applying correction" when mode=correction with no items yet', () => {
      render(<AiAnalyzeProgress active mode="correction" />);
      expect(screen.getByText(/^Applying correction/)).toBeTruthy();
    });

    it('shows "N items found" when mode=locking', () => {
      render(
        <AiAnalyzeProgress
          active
          complete
          mode="locking"
          partialText='{"name": "Box", "items": ["A", "B"'
        />,
      );
      expect(screen.getByText(/2 items found/)).toBeTruthy();
    });

    it('shows "No items found" when mode=locking with empty partialText', () => {
      render(<AiAnalyzeProgress active complete mode="locking" />);
      expect(screen.getByText(/No items found/)).toBeTruthy();
    });

    it('renders no label row in mode=idle', () => {
      const { container } = render(<AiAnalyzeProgress active={false} mode="idle" />);
      expect(container.querySelector('output')).toBeNull();
    });
  });

  describe('cancel button', () => {
    it('renders cancel button when active and onCancel is supplied', () => {
      render(<AiAnalyzeProgress active mode="analyze" onCancel={vi.fn()} />);
      expect(screen.getByRole('button', { name: /cancel scan/i })).toBeTruthy();
    });

    it('does not render cancel button when onCancel is omitted', () => {
      render(<AiAnalyzeProgress active mode="analyze" />);
      expect(screen.queryByRole('button', { name: /cancel scan/i })).toBeNull();
    });

    it('does not render cancel button when complete', () => {
      render(<AiAnalyzeProgress active complete mode="locking" onCancel={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /cancel scan/i })).toBeNull();
    });

    it('does not render cancel button when not active', () => {
      render(<AiAnalyzeProgress active={false} mode="idle" onCancel={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /cancel scan/i })).toBeNull();
    });

    it('invokes onCancel when clicked', () => {
      const onCancel = vi.fn();
      render(<AiAnalyzeProgress active mode="analyze" onCancel={onCancel} />);
      fireEvent.click(screen.getByRole('button', { name: /cancel scan/i }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('completion visual state', () => {
    it('uses the success-green progress fill when complete', () => {
      const { container } = render(
        <AiAnalyzeProgress active complete mode="locking" />,
      );
      expect(container.querySelector('.ai-progress-fill-complete')).toBeTruthy();
    });

    it('uses the streaming progress fill when not complete', () => {
      const { container } = render(<AiAnalyzeProgress active mode="analyze" />);
      expect(container.querySelector('.ai-progress-fill')).toBeTruthy();
      expect(container.querySelector('.ai-progress-fill-complete')).toBeNull();
    });
  });

  describe('aria-live region', () => {
    it('wraps the label in an aria-live="polite" output element', () => {
      const { container } = render(
        <AiAnalyzeProgress active mode="analyze" partialText='{"items": ["A"' />,
      );
      const output = container.querySelector('output');
      expect(output).toBeTruthy();
      expect(output?.getAttribute('aria-live')).toBe('polite');
    });
  });
});
