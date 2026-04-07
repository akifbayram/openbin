import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bin } from '@/types';
import { PreviewPanel } from '../PreviewPanel';

// Mock sheet components to avoid their heavy dependencies (QR generation etc.)
vi.mock('../LabelSheet', () => ({
  LabelSheet: () => <div data-testid="label-sheet">labels</div>,
}));
vi.mock('../NameSheet', () => ({
  NameSheet: () => <div data-testid="name-sheet">names</div>,
}));
vi.mock('../ItemSheet', () => ({
  ItemSheet: () => <div data-testid="item-sheet">items</div>,
}));
vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({ bins: 'bins', bin: 'bin', location: 'location', area: 'area' }),
}));

function makeBin(id = 'b1'): Bin {
  return {
    id, short_code: id, location_id: 'loc1', name: 'Test Bin',
    area_id: null, area_name: '', items: [], notes: '', tags: [],
    icon: 'package', color: '', card_style: '', created_by: 'u1',
    created_by_name: 'User', visibility: 'location',
    custom_fields: {}, created_at: '2024-01-01', updated_at: '2024-01-01',
  };
}

describe('PreviewPanel scaling', () => {
  let observeSpy: ReturnType<typeof vi.fn>;
  let disconnectSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    observeSpy = vi.fn();
    disconnectSpy = vi.fn();

    vi.stubGlobal('ResizeObserver', class {
      constructor(_cb: ResizeObserverCallback) {}
      observe = observeSpy;
      disconnect = disconnectSpy;
      unobserve = vi.fn();
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const baseProps = {
    pdfLoading: false,
    onDownloadPDF: vi.fn(),
    labelSheetProps: { bins: [] as Bin[] } as React.ComponentProps<typeof import('../LabelSheet').LabelSheet>,
    printMode: 'labels' as const,
    itemSheetProps: { bins: [] as Bin[] } as React.ComponentProps<typeof import('../ItemSheet').ItemSheet>,
    nameSheetProps: { bins: [] as Bin[], format: undefined } as unknown as React.ComponentProps<typeof import('../NameSheet').NameSheet>,
  };

  it('creates ResizeObserver when bins transition from empty to selected', () => {
    // First render: no bins selected — preview container not in DOM
    const { rerender } = render(
      <PreviewPanel {...baseProps} selectedBins={[]} />,
    );
    expect(observeSpy).not.toHaveBeenCalled();

    // Re-render with bins — preview container now in DOM
    const bins = [makeBin()];
    rerender(
      <PreviewPanel {...baseProps} selectedBins={bins} />,
    );

    // ResizeObserver should now observe the preview container
    expect(observeSpy).toHaveBeenCalled();
  });
});
