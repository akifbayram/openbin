import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StepIndicator } from '../stepper';

const threeSteps = [
  { id: 'upload', label: 'Upload' },
  { id: 'review', label: 'Review' },
  { id: 'confirm', label: 'Confirm' },
];

const twoSteps = [
  { id: 'edit', label: 'Edit' },
  { id: 'done', label: 'Done' },
];

describe('StepIndicator', () => {
  it('renders all step labels', () => {
    render(<StepIndicator steps={threeSteps} currentStepIndex={0} />);

    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('marks current step with aria-current="step"', () => {
    const { container } = render(<StepIndicator steps={threeSteps} currentStepIndex={1} />);

    const currentTrigger = container.querySelector('[aria-current="step"]');
    expect(currentTrigger).toBeInTheDocument();
    expect(currentTrigger).toHaveTextContent('2');
  });

  it('shows check icons for completed steps', () => {
    render(<StepIndicator steps={threeSteps} currentStepIndex={2} />);

    // Steps 0 and 1 are completed, step 2 is active
    const checkIcons = screen.getAllByTestId('step-check');
    expect(checkIcons).toHaveLength(2);
  });

  it('shows step numbers for active and future steps', () => {
    const { container } = render(<StepIndicator steps={threeSteps} currentStepIndex={1} />);

    // Step 0 is completed (check icon), step 1 is active (shows "2"), step 2 is future (shows "3")
    const checkIcons = screen.getAllByTestId('step-check');
    expect(checkIcons).toHaveLength(1);

    // Active step shows its 1-based number
    expect(container.querySelector('[aria-current="step"]')).toHaveTextContent('2');

    // Future step renders its 1-based number and is not the current step
    const futureNumber = screen.getByText('3');
    expect(futureNumber.closest('[aria-current="step"]')).toBeNull();
  });

  it('renders with 2 steps', () => {
    const { container } = render(<StepIndicator steps={twoSteps} currentStepIndex={0} />);

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();

    expect(container.querySelector('[aria-current="step"]')).toHaveTextContent('1');
  });

  it('applies custom className', () => {
    const { container } = render(
      <StepIndicator steps={threeSteps} currentStepIndex={0} className="my-custom-class" />,
    );

    const root = container.firstElementChild;
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });
});
