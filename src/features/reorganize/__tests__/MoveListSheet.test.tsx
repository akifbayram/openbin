import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_QR_STYLE } from '@/features/print/usePrintSettings';
import type { Bin } from '@/types';
import type { SourceCard } from '../deriveMoveList';
import { MoveListSheet } from '../MoveListSheet';

vi.mock('@/features/print/itemSheetQr', () => ({
  generateItemSheetQrMap: vi.fn(async (binIds: string[]) => {
    const map = new Map<string, string>();
    for (const id of binIds) map.set(id, `data:image/png;base64,${id}`);
    return map;
  }),
}));

vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({ bin: 'bin', bins: 'bins', Bin: 'Bin', Bins: 'Bins' }),
}));

function makeBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'src-1',
    short_code: 'SRC111',
    location_id: 'loc1',
    name: 'Garage Bench',
    area_id: null,
    area_name: '',
    items: [],
    notes: '',
    tags: [],
    icon: 'Package',
    color: '',
    card_style: '',
    created_by: 'u1',
    created_by_name: 'U',
    visibility: 'location',
    custom_fields: {},
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  };
}

function makeCard(overrides: Partial<SourceCard> = {}): SourceCard {
  return {
    sourceBin: makeBin(),
    outgoingClusters: [
      {
        destinationName: 'Hand Tools',
        destinationTags: [],
        items: [
          { name: 'Hammer', quantity: null },
          { name: 'Screw', quantity: 5 },
        ],
      },
    ],
    renameShaped: true,
    ...overrides,
  };
}

const baseProps = {
  sourceCards: [makeCard()],
  areas: [],
  qrStyle: DEFAULT_QR_STYLE,
  totalItems: 2,
  totalMoves: 1,
  totalDestinationBins: 1,
  summary: 'Group by type',
};

describe('MoveListSheet', () => {
  it('renders header with title, date, and counts', async () => {
    render(<MoveListSheet {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Move List')).toBeTruthy());
    expect(screen.getByText('Group by type')).toBeTruthy();
    expect(screen.getByText(/1 → 1 bin · 2 items · 1 move/)).toBeTruthy();
  });

  it('renders a section per source bin with QR code', async () => {
    render(<MoveListSheet {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Garage Bench')).toBeTruthy());
    expect(screen.getByTestId('move-list-qr-src-1')).toBeTruthy();
    expect(screen.getByText('SRC111')).toBeTruthy();
  });

  it('renders a checkbox per outgoing cluster', async () => {
    render(<MoveListSheet {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Garage Bench')).toBeTruthy());
    const checkboxes = screen.getAllByTestId(/^move-list-cluster-check/);
    expect(checkboxes).toHaveLength(1);
  });

  it('renders destination pill and inline items', async () => {
    render(<MoveListSheet {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Hand Tools')).toBeTruthy());
    expect(screen.getByText(/Hammer/)).toBeTruthy();
    expect(screen.getByText(/5 Screw/)).toBeTruthy();
  });

  it('renders `(new)` tag next to destination names', async () => {
    render(<MoveListSheet {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Hand Tools')).toBeTruthy());
    expect(screen.getByText('new')).toBeTruthy();
  });

  it('renders two sections when given two source cards', async () => {
    const twoCards = {
      ...baseProps,
      sourceCards: [
        makeCard({ sourceBin: makeBin({ id: 'src-1', name: 'Garage', short_code: 'SRC111' }) }),
        makeCard({ sourceBin: makeBin({ id: 'src-2', name: 'Kitchen', short_code: 'SRC222' }) }),
      ],
    };
    render(<MoveListSheet {...twoCards} />);
    await waitFor(() => expect(screen.getByText('Garage')).toBeTruthy());
    expect(screen.getByText('Kitchen')).toBeTruthy();
    expect(screen.getByTestId('move-list-qr-src-1')).toBeTruthy();
    expect(screen.getByTestId('move-list-qr-src-2')).toBeTruthy();
  });

  it('renders "No source bins selected" when list is empty', () => {
    render(<MoveListSheet {...baseProps} sourceCards={[]} totalItems={0} totalMoves={0} totalDestinationBins={0} />);
    expect(screen.getByText(/No source bins/i)).toBeTruthy();
  });
});
