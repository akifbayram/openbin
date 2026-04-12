import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryAnswerBody } from '../QueryAnswerBody';

describe('QueryAnswerBody', () => {
  it('renders answer text and match rows', () => {
    render(
      <QueryAnswerBody
        queryResult={{
          answer: 'Found in the kitchen drawer.',
          matches: [
            { bin_id: 'b1', name: 'Kitchen drawer', area_name: 'Pantry', items: ['AA'], tags: [], relevance: 'exact' },
          ],
        }}
        isStreaming={false}
        onBinClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Found in the kitchen drawer.')).toBeDefined();
    expect(screen.getByText('Kitchen drawer')).toBeDefined();
    expect(screen.getByText('Pantry')).toBeDefined();
  });

  it('renders streaming text when streaming and no result', () => {
    const { container } = render(
      <QueryAnswerBody
        queryResult={null}
        streamingText="Searching…"
        isStreaming
        onBinClick={vi.fn()}
      />,
    );
    expect(screen.getByText(/Searching/)).toBeDefined();
    expect(container.querySelector('[data-streaming-cursor]')).not.toBeNull();
  });

  it('does NOT render a follow-up textarea or Back button', () => {
    render(
      <QueryAnswerBody
        queryResult={{ answer: 'Answer', matches: [] }}
        isStreaming={false}
        onBinClick={vi.fn()}
      />,
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });
});
