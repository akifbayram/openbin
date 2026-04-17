import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QueryAnswerBody } from '../QueryAnswerBody';
import type { QueryMatch } from '../useInventoryQuery';

const makeMatch = (overrides?: Partial<QueryMatch>): QueryMatch => ({
  bin_id: 'b1',
  name: 'Camping Gear',
  area_name: 'Garage',
  items: [{ id: 'i1', name: 'Tent', quantity: null }],
  tags: [],
  relevance: '',
  icon: '',
  color: '#22c55e',
  ...overrides,
});

describe('QueryAnswerBody', () => {
  it('renders intro text when answer is non-empty', () => {
    render(
      <QueryAnswerBody
        queryResult={{ answer: 'Found in the garage.', matches: [] }}
        onBinClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Found in the garage.')).toBeDefined();
  });

  it('renders each match bin name', () => {
    render(
      <QueryAnswerBody
        queryResult={{
          answer: 'Check these bins.',
          matches: [
            makeMatch({ bin_id: 'b1', name: 'Camping Gear', area_name: 'Garage' }),
            makeMatch({ bin_id: 'b2', name: 'Tool Box', area_name: 'Shed' }),
          ],
        }}
        onBinClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Camping Gear')).toBeDefined();
    expect(screen.getByText('Tool Box')).toBeDefined();
  });

  it('renders item names for each match', () => {
    render(
      <QueryAnswerBody
        queryResult={{
          answer: 'Check the garage.',
          matches: [
            makeMatch({
              bin_id: 'b1',
              name: 'Camping Gear',
              items: [
                { id: 'i1', name: 'Tent', quantity: null },
                { id: 'i2', name: 'Sleeping Bag', quantity: 2 },
              ],
            }),
            makeMatch({
              bin_id: 'b2',
              name: 'Tool Box',
              items: [{ id: 'i3', name: 'Hammer', quantity: null }],
            }),
          ],
        }}
        onBinClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Tent')).toBeDefined();
    expect(screen.getByText('Sleeping Bag')).toBeDefined();
    expect(screen.getByText('Hammer')).toBeDefined();
  });

  it('invokes onBinClick with correct bin id when a bin header is clicked', async () => {
    const onBinClick = vi.fn();
    render(
      <QueryAnswerBody
        queryResult={{
          answer: 'Found it.',
          matches: [makeMatch({ bin_id: 'bin-abc', name: 'My Bin' })],
        }}
        onBinClick={onBinClick}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /open my bin/i }));
    expect(onBinClick).toHaveBeenCalledWith('bin-abc', undefined);
  });

  it('shows no-matches fallback when both matches is empty and answer is empty', () => {
    render(
      <QueryAnswerBody
        queryResult={{ answer: '', matches: [] }}
        onBinClick={vi.fn()}
      />,
    );
    expect(screen.getByText(/no matching bins found/i)).toBeDefined();
  });

  it('does NOT show fallback when matches is empty but answer has content', () => {
    render(
      <QueryAnswerBody
        queryResult={{ answer: 'I can only see bins in your current view.', matches: [] }}
        onBinClick={vi.fn()}
      />,
    );
    expect(screen.queryByText(/no matching bins found/i)).toBeNull();
    expect(screen.getByText('I can only see bins in your current view.')).toBeDefined();
  });

  it('handles trashed matches — header has data-trashed="true"', () => {
    render(
      <QueryAnswerBody
        queryResult={{
          answer: 'Found in trash.',
          matches: [makeMatch({ bin_id: 'b-trash', name: 'Old Box', is_trashed: true })],
        }}
        onBinClick={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: /open old box/i });
    expect(btn.getAttribute('data-trashed')).toBe('true');
  });
});
