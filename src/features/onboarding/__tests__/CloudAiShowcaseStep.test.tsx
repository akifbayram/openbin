import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudAiShowcaseStep } from '../steps/CloudAiShowcaseStep';

describe('CloudAiShowcaseStep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders title and subtitle', () => {
    render(<CloudAiShowcaseStep onNext={vi.fn()} />);

    expect(screen.getByText('AI-powered inventory')).toBeInTheDocument();
    expect(screen.getByText(/Included in your plan/)).toBeInTheDocument();
  });

  it('renders Continue button and calls onNext when clicked', () => {
    const onNext = vi.fn();
    render(<CloudAiShowcaseStep onNext={onNext} />);

    act(() => {
      vi.advanceTimersByTime(7000);
    });

    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('does not render API key setup messaging', () => {
    render(<CloudAiShowcaseStep onNext={vi.fn()} />);

    expect(screen.queryByText(/API key/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Set Up Now')).not.toBeInTheDocument();
    expect(screen.queryByText('Maybe Later')).not.toBeInTheDocument();
  });
});
