import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Bin } from '@/types';
import { BinDetailRail } from '../BinDetailRail';
import type { useAutoSaveBin } from '../useAutoSaveBin';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn(() => ({ activeLocationId: 'loc-1', token: 't' })) }));
vi.mock('@/features/areas/AreaPicker', () => ({ AreaPicker: () => <div>area-picker</div> }));
vi.mock('../TagInput', () => ({ TagInput: () => <div>tag-input</div> }));
vi.mock('../VisibilityPicker', () => ({ VisibilityPicker: () => <div>visibility-picker</div> }));
vi.mock('@/features/tags/useTagStyle', () => ({ useTagStyle: vi.fn(() => () => ({})) }));
vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({ bin: 'bin', bins: 'bins', Bin: 'Bin', Bins: 'Bins', area: 'area', areas: 'areas', Area: 'Area', Areas: 'Areas', location: 'location', locations: 'locations', Location: 'Location', Locations: 'Locations' }),
}));

const bin: Bin = {
  id: 'abc123', short_code: 'ABC123', location_id: 'loc-1', name: 'Test Bin',
  area_id: 'area-1', area_name: 'Basement · Shelf B', items: [],
  notes: '', tags: ['electrical', 'tools'], icon: 'Package', color: '',
  card_style: '', created_by: 'u1', created_by_name: 'Akif',
  visibility: 'location', custom_fields: {},
  created_at: '2026-03-04T12:00:00Z', updated_at: '2026-04-09T12:00:00Z',
};

const baseProps = {
  bin,
  canEdit: false,
  canChangeVisibility: false,
  canChangeCode: false,
  onChangeCode: vi.fn(),
  allTags: [],
  activeLocationId: 'loc-1',
  autoSave: {
    saveAreaId: vi.fn(), saveTags: vi.fn(), saveVisibility: vi.fn(),
    saveName: vi.fn(), saveNotes: vi.fn(), saveIcon: vi.fn(),
    saveColor: vi.fn(), saveCardStyle: vi.fn(), saveCustomFields: vi.fn(),
    savedFields: new Set<string>(), savingFields: new Set<string>(),
  } as ReturnType<typeof useAutoSaveBin>,
};

describe('BinDetailRail (view mode)', () => {
  it('renders area and tags', () => {
    render(
      <MemoryRouter>
        <BinDetailRail {...baseProps} />
      </MemoryRouter>
    );
    expect(screen.getByText('Basement · Shelf B')).toBeInTheDocument();
    expect(screen.getByText('electrical')).toBeInTheDocument();
    expect(screen.getByText('tools')).toBeInTheDocument();
  });

  it('shows "No area" placeholder when area_name is empty', () => {
    render(
      <MemoryRouter>
        <BinDetailRail {...baseProps} bin={{ ...bin, area_name: '', area_id: null }} />
      </MemoryRouter>
    );
    expect(screen.getByText('No area')).toBeInTheDocument();
  });

  it('shows "No tags" placeholder when tags list is empty', () => {
    render(
      <MemoryRouter>
        <BinDetailRail {...baseProps} bin={{ ...bin, tags: [] }} />
      </MemoryRouter>
    );
    expect(screen.getByText('No tags')).toBeInTheDocument();
  });
});
