import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiTurnError } from '../AiTurnError';

describe('AiTurnError', () => {
  it('renders the error message', () => {
    render(<AiTurnError error="Rate limit reached" canRetry onRetry={vi.fn()} />);
    expect(screen.getByText('Rate limit reached')).toBeDefined();
  });

  it('calls onRetry when Retry is clicked', () => {
    const onRetry = vi.fn();
    render(<AiTurnError error="boom" canRetry onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('hides Retry button when canRetry is false', () => {
    render(<AiTurnError error="boom" canRetry={false} onRetry={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });
});
