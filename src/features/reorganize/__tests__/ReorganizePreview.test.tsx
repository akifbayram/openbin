import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Area, Bin } from '@/types';
import { ReorganizePreview } from '../ReorganizePreview';
import type { ReorgResponse } from '../useReorganize';

vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({ bin: 'bin', bins: 'bins', Bin: 'Bin', Bins: 'Bins' }),
}));

vi.mock('@/features/print/usePrintSettings', () => ({
  DEFAULT_QR_STYLE: {},
}));

vi.mock('@/features/print/itemSheetQr', () => ({
  generateItemSheetQrMap: vi.fn(async () => new Map()),
}));

function makeBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'b',
    short_code: 'ABC',
    location_id: 'loc',
    name: 'Default',
    area_id: null,
    area_name: '',
    items: [],
    notes: '',
    tags: [],
    icon: 'Package',
    color: '',
    card_style: '',
    created_by: 'u',
    created_by_name: 'U',
    visibility: 'location',
    custom_fields: {},
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  };
}

const baseProps = {
  isStreaming: false,
  isApplying: false,
  partialResult: { bins: [], summary: '' },
  areas: [] as Area[],
  onAccept: vi.fn(),
  onCancel: vi.fn(),
  onRegenerate: vi.fn(),
};

describe('ReorganizePreview — source-oriented', () => {
  it('renders source cards in selection (input) order', () => {
    const inputBins = [
      makeBin({ id: 'b1', name: 'Alpha Bin', items: [{ id: 'i1', name: 'Hammer', quantity: null }] }),
      makeBin({ id: 'b2', name: 'Beta Bin', items: [{ id: 'i2', name: 'Wrench', quantity: null }] }),
    ];
    const result: ReorgResponse = {
      bins: [{ name: 'Tools', items: ['Hammer', 'Wrench'], tags: [] }],
      summary: '',
    };
    render(<ReorganizePreview {...baseProps} inputBins={inputBins} result={result} />);
    const alpha = screen.getAllByText('Alpha Bin')[0];
    const beta = screen.getAllByText('Beta Bin')[0];
    expect(alpha.compareDocumentPosition(beta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows `will be kept` tag when a source is preserved (name matches a destination)', () => {
    const inputBins = [makeBin({
      id: 'b1',
      name: 'Hand Tools',
      items: [{ id: 'i1', name: 'Hammer', quantity: null }],
    })];
    const result: ReorgResponse = {
      bins: [{ name: 'Hand Tools', items: ['Hammer'], tags: [] }],
      summary: '',
    };
    render(<ReorganizePreview {...baseProps} inputBins={inputBins} result={result} />);
    expect(screen.getAllByText(/will be kept/)[0]).toBeTruthy();
  });

  it('shows `will be emptied` tag when no destination name matches the source', () => {
    const inputBins = [makeBin({
      id: 'b1',
      name: 'Garage',
      items: [{ id: 'i1', name: 'Hammer', quantity: null }],
    })];
    const result: ReorgResponse = {
      bins: [{ name: 'Tools', items: ['Hammer'], tags: [] }],
      summary: '',
    };
    render(<ReorganizePreview {...baseProps} inputBins={inputBins} result={result} />);
    expect(screen.getAllByText(/will be emptied/)[0]).toBeTruthy();
  });

  it('shows `kept` pill instead of `new` when destination name matches source name', () => {
    const inputBins = [makeBin({
      id: 'b1',
      name: 'Tools',
      items: [{ id: 'i1', name: 'Hammer', quantity: null }],
    })];
    const result: ReorgResponse = {
      bins: [{ name: 'Tools', items: ['Hammer'], tags: [] }],
      summary: '',
    };
    render(<ReorganizePreview {...baseProps} inputBins={inputBins} result={result} />);
    expect(screen.getAllByText('kept')[0]).toBeTruthy();
  });

  it('shows ×N destinations annotation when same item goes to multiple destinations', () => {
    const inputBins = [makeBin({
      id: 'b1',
      name: 'Src',
      items: [{ id: 'i1', name: 'Batteries', quantity: null }],
    })];
    const result: ReorgResponse = {
      bins: [
        { name: 'D1', items: ['Batteries'], tags: [] },
        { name: 'D2', items: ['Batteries'], tags: [] },
      ],
      summary: '',
    };
    render(<ReorganizePreview {...baseProps} inputBins={inputBins} result={result} />);
    expect(screen.getAllByText(/×2 destinations/).length).toBeGreaterThanOrEqual(1);
  });

  it('Accept button includes keep/create counts when preservations > 0', () => {
    const inputBins = [
      makeBin({ id: 'b1', name: 'Hand Tools', items: [{ id: 'i1', name: 'Hammer', quantity: null }] }),
      makeBin({ id: 'b2', name: 'Garage', items: [{ id: 'i2', name: 'Wrench', quantity: null }] }),
    ];
    const result: ReorgResponse = {
      bins: [
        { name: 'Hand Tools', items: ['Hammer', 'Wrench'], tags: [] },
      ],
      summary: '',
    };
    render(<ReorganizePreview {...baseProps} inputBins={inputBins} result={result} />);
    expect(screen.getByRole('button', { name: /keep 1 bin/ })).toBeTruthy();
  });

  it('Accept button uses create-only copy when no preservations', () => {
    const inputBins = [makeBin({ id: 'b1', name: 'Src', items: [{ id: 'i1', name: 'A', quantity: null }, { id: 'i2', name: 'B', quantity: null }] })];
    const result: ReorgResponse = {
      bins: [{ name: 'Dest', items: ['A', 'B'], tags: [] }],
      summary: '',
    };
    render(<ReorganizePreview {...baseProps} inputBins={inputBins} result={result} />);
    expect(screen.getByRole('button', { name: /Accept — Move 2 items, create 1 bin/ })).toBeTruthy();
  });
});
