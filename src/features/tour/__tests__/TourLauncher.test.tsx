import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TourLauncher } from '../TourLauncher';
import { TourProvider } from '../TourProvider';
import type { UseTourReturn } from '../useTour';

vi.mock('@/lib/userPreferences', () => ({
  useUserPreferences: vi.fn(() => ({
    preferences: { tours_seen: [] as string[] },
    isLoading: false,
    updatePreferences: vi.fn(),
  })),
}));

import { useUserPreferences } from '@/lib/userPreferences';

function makeTour(): UseTourReturn {
  return {
    isActive: false,
    currentStep: 0,
    totalSteps: 0,
    step: null,
    targetRect: null,
    transitioning: false,
    currentTourId: null,
    start: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    skip: vi.fn(),
  };
}

describe('TourLauncher', () => {
  it('renders icon button with tour title in aria-label', () => {
    const tour = makeTour();
    render(
      <TourProvider tour={tour}>
        <TourLauncher tourId="highlights" />
      </TourProvider>,
    );
    expect(screen.getByRole('button', { name: /Tour: Highlights/i })).toBeInTheDocument();
  });

  it('calls tour.start(tourId) on click', () => {
    const tour = makeTour();
    render(
      <TourProvider tour={tour}>
        <TourLauncher tourId="highlights" />
      </TourProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Tour: Highlights/i }));
    expect(tour.start).toHaveBeenCalledWith('highlights');
  });

  it('applies seen-state class when tour is in tours_seen', () => {
    (useUserPreferences as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      preferences: { tours_seen: ['highlights'] },
      isLoading: false,
      updatePreferences: vi.fn(),
    });
    const tour = makeTour();
    render(
      <TourProvider tour={tour}>
        <TourLauncher tourId="highlights" />
      </TourProvider>,
    );
    expect(screen.getByRole('button', { name: /Tour: Highlights/i })).toHaveClass('opacity-60');
  });
});
