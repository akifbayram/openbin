import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ReorganizeTagsPreview } from '../ReorganizeTagsPreview';
import type { TagProposalResult } from '../useReorganizeTags';

vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({ bin: 'bin', bins: 'bins' }),
}));

const result: TagProposalResult = {
  taxonomy: {
    newTags: [{ tag: 'fasteners' }, { tag: 'cables' }],
    renames: [{ from: 'tool', to: 'tools' }],
    merges: [],
    parents: [],
  },
  assignments: [
    { binId: 'bin-1', add: ['fasteners'], remove: [] },
    { binId: 'bin-2', add: ['cables'], remove: [] },
  ],
  summary: 'Proposed 2 new tags and 1 rename.',
};

const binMap = new Map([
  ['bin-1', { id: 'bin-1', name: 'Kitchen Tools', tags: [] }],
  ['bin-2', { id: 'bin-2', name: 'Workshop Drawer', tags: [] }],
]);

function renderIt(overrides: Partial<React.ComponentProps<typeof ReorganizeTagsPreview>> = {}) {
  return render(
    <MemoryRouter>
      <ReorganizeTagsPreview
        result={result}
        partialResult={{ taxonomy: result.taxonomy, assignments: result.assignments, summary: result.summary }}
        binMap={binMap as any}
        isStreaming={false}
        isApplying={false}
        onAccept={vi.fn()}
        onCancel={vi.fn()}
        onRegenerate={vi.fn()}
        selections={{
          newTags: new Set(['fasteners', 'cables']),
          renames: new Set(['tool->tools']),
          merges: new Set(),
          parents: new Set(),
          assignments: new Set(['bin-1', 'bin-2']),
        }}
        onSelectionsChange={vi.fn()}
        {...overrides}
      />
    </MemoryRouter>
  );
}

describe('ReorganizeTagsPreview', () => {
  it('renders new tags section', () => {
    renderIt();
    // 'fasteners' appears in the New tags section and in the bin-1 assignment row as '+ fasteners'
    expect(screen.getAllByText(/fasteners/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cables/i).length).toBeGreaterThan(0);
  });

  it('renders rename rows', () => {
    renderIt();
    expect(screen.getByText(/tool → tools/)).toBeInTheDocument();
    expect(screen.getByText(/→/)).toBeInTheDocument();
  });

  it('renders per-bin rows', () => {
    renderIt();
    expect(screen.getByText('Kitchen Tools')).toBeInTheDocument();
    expect(screen.getByText('Workshop Drawer')).toBeInTheDocument();
  });

  it('fires onSelectionsChange when a bin checkbox is toggled', async () => {
    const onSelectionsChange = vi.fn();
    renderIt({ onSelectionsChange });
    const cbs = screen.getAllByRole('checkbox');
    const binCb = cbs.find((c) => c.getAttribute('aria-label')?.includes('Kitchen Tools'));
    expect(binCb).toBeDefined();
    await userEvent.click(binCb!);
    expect(onSelectionsChange).toHaveBeenCalled();
  });

  it('shows empty-changes message', () => {
    renderIt({
      result: { taxonomy: { newTags: [], renames: [], merges: [], parents: [] }, assignments: [], summary: 'none' },
      partialResult: { taxonomy: { newTags: [], renames: [], merges: [], parents: [] }, assignments: [], summary: 'none' },
    });
    expect(screen.getByText(/No tag changes suggested/i)).toBeInTheDocument();
  });
});
