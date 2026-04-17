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
            {
              bin_id: 'b1',
              name: 'Kitchen drawer',
              area_name: 'Pantry',
              items: [{ id: 'i1', name: 'AA', quantity: null }],
              tags: [],
              relevance: 'exact',
              icon: '',
              color: '',
            },
          ],
        }}
        onBinClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Found in the kitchen drawer.')).toBeDefined();
    expect(screen.getByText('Kitchen drawer')).toBeDefined();
    expect(screen.getByText('Pantry')).toBeDefined();
  });

  it('renders item names from enriched shape', () => {
    render(
      <QueryAnswerBody
        queryResult={{
          answer: 'Check the garage bin.',
          matches: [
            {
              bin_id: 'b2',
              name: 'Garage bin',
              area_name: '',
              items: [
                { id: 'i1', name: 'Tent', quantity: null },
                { id: 'i2', name: 'Stakes', quantity: 4 },
              ],
              tags: [],
              relevance: 'partial',
              icon: '',
              color: '',
            },
          ],
        }}
        onBinClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Tent, Stakes')).toBeDefined();
  });

  it('does NOT render a follow-up textarea or Back button', () => {
    render(
      <QueryAnswerBody
        queryResult={{ answer: 'Answer', matches: [] }}
        onBinClick={vi.fn()}
      />,
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });
});
