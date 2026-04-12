import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiTurnExecutionResult } from '../AiTurnExecutionResult';
import type { ExecutionResult } from '../useActionExecutor';

describe('AiTurnExecutionResult', () => {
  const base: ExecutionResult = {
    completedActions: [],
    completedActionIndices: [0, 1, 2],
    createdBins: [],
    failedCount: 0,
  };

  it('renders a success summary with completed count', () => {
    render(<AiTurnExecutionResult result={base} onBinClick={vi.fn()} />);
    expect(screen.getByText(/Applied 3 changes/i)).toBeDefined();
  });

  it('renders created bins as clickable cards', () => {
    const result: ExecutionResult = {
      ...base,
      createdBins: [{ id: 'b1', name: 'New Bin', icon: 'package', color: '#abc' }],
    };
    const onBinClick = vi.fn();
    render(<AiTurnExecutionResult result={result} onBinClick={onBinClick} />);
    fireEvent.click(screen.getByRole('button', { name: /new bin/i }));
    expect(onBinClick).toHaveBeenCalledWith('b1', false);
  });

  it('renders failure count when failedCount > 0', () => {
    render(<AiTurnExecutionResult result={{ ...base, failedCount: 1 }} onBinClick={vi.fn()} />);
    expect(screen.getByText(/1 failed/i)).toBeDefined();
  });

  it('pluralizes correctly for single change', () => {
    render(<AiTurnExecutionResult result={{ ...base, completedActionIndices: [0] }} onBinClick={vi.fn()} />);
    expect(screen.getByText(/Applied 1 change(?!s)/i)).toBeDefined();
  });
});
