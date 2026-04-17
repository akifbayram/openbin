import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationThread } from '../ConversationThread';
import type { Turn } from '../conversationTurns';

vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({
    bin: 'bin', bins: 'bins', Bin: 'Bin', Bins: 'Bins',
    area: 'area', areas: 'areas', Area: 'Area', Areas: 'Areas',
    location: 'location', locations: 'locations', Location: 'Location', Locations: 'Locations',
  }),
}));

describe('ConversationThread', () => {
  const handlers = {
    onToggleAction: vi.fn(),
    onExecute: vi.fn(),
    onBinClick: vi.fn(),
    onRetry: vi.fn(),
  };

  it('renders user-text turns as bubbles', () => {
    const turns: Turn[] = [{ kind: 'user-text', id: 'u1', text: 'hi there', createdAt: 0 }];
    render(<ConversationThread turns={turns} {...handlers} />);
    expect(screen.getByText('hi there')).toBeDefined();
  });

  it('renders a thinking turn with a busy indicator', () => {
    const turns: Turn[] = [{ kind: 'ai-thinking', id: 'a1', phase: 'parsing' }];
    render(<ConversationThread turns={turns} {...handlers} />);
    expect(screen.getByLabelText(/AI is thinking/)).toBeDefined();
  });

  it('renders a pending command-preview turn with Apply button', () => {
    const turns: Turn[] = [{
      kind: 'ai-command-preview', id: 'c1',
      actions: [{ type: 'create_bin', name: 'X' } as never],
      interpretation: 'Create X',
      checkedActions: new Map([[0, true]]),
      status: 'pending',
    }];
    render(<ConversationThread turns={turns} {...handlers} />);
    expect(screen.getByRole('button', { name: /apply/i })).toBeDefined();
  });

  it('renders an executed command-preview as an execution-result summary', () => {
    const turns: Turn[] = [{
      kind: 'ai-command-preview', id: 'c1',
      actions: [{ type: 'create_bin', name: 'X' } as never],
      interpretation: 'Create X',
      checkedActions: new Map([[0, true]]),
      status: 'executed',
      executionResult: {
        completedActions: [],
        completedActionIndices: [0],
        createdBins: [],
        failedCount: 0,
      },
    }];
    render(<ConversationThread turns={turns} {...handlers} />);
    expect(screen.getByText(/Applied 1 change/i)).toBeDefined();
  });

  it('renders a query-result turn', () => {
    const turns: Turn[] = [{
      kind: 'ai-query-result', id: 'q1',
      queryResult: { answer: 'Yes', matches: [] },
    }];
    render(<ConversationThread turns={turns} {...handlers} />);
    expect(screen.getByText('Yes')).toBeDefined();
  });

  it('renders an error turn with retry', () => {
    const turns: Turn[] = [{ kind: 'ai-error', id: 'e1', error: 'nope', canRetry: true }];
    render(<ConversationThread turns={turns} {...handlers} />);
    expect(screen.getByText('nope')).toBeDefined();
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
  });

  it('has role="log" with aria-live polite', () => {
    const { container } = render(<ConversationThread turns={[]} {...handlers} />);
    const logEl = container.querySelector('[role="log"]');
    expect(logEl).not.toBeNull();
    expect(logEl?.getAttribute('aria-live')).toBe('polite');
  });
});
