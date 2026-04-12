import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AiTurnThinking } from '../AiTurnThinking';

describe('AiTurnThinking', () => {
  it('renders a thinking label and aria-busy attribute', () => {
    render(<AiTurnThinking phase="parsing" />);
    expect(screen.getByLabelText(/AI is thinking/i)).toBeDefined();
  });

  it('shows phase-specific label', () => {
    render(<AiTurnThinking phase="querying" />);
    expect(screen.getByText(/searching/i)).toBeDefined();
  });

  it('uses "Applying" label for executing phase', () => {
    render(<AiTurnThinking phase="executing" />);
    expect(screen.getByText(/applying/i)).toBeDefined();
  });
});
