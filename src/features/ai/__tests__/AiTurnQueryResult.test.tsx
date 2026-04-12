import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiTurnQueryResult } from '../AiTurnQueryResult';

describe('AiTurnQueryResult', () => {
  it('renders the answer within a flat-card', () => {
    const { container } = render(
      <AiTurnQueryResult
        queryResult={{ answer: 'Found it', matches: [] }}
        isStreaming={false}
        onBinClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Found it')).toBeDefined();
    expect((container.firstChild as HTMLElement).className).toContain('flat-card');
  });

  it('does not render a follow-up textarea or Back button', () => {
    render(
      <AiTurnQueryResult
        queryResult={{ answer: '', matches: [] }}
        isStreaming={false}
        onBinClick={vi.fn()}
      />,
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });
});
