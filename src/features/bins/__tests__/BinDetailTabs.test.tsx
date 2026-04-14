import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bin } from '@/types';
import { BinDetailTabs } from '../BinDetailTabs';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn(() => ({ activeLocationId: 'loc-1', token: 't' })) }));
vi.mock('../BinDetailContentsTab', () => ({
  BinDetailContentsTab: () => <div data-testid="tab-contents">contents</div>,
}));
vi.mock('../BinDetailPhotosTab', () => ({
  BinDetailPhotosTab: () => <div data-testid="tab-photos">photos</div>,
}));
vi.mock('../BinDetailInformationTab', () => ({
  BinDetailInformationTab: () => <div data-testid="tab-information">information</div>,
}));

const bin: Bin = {
  id: 'abc123', short_code: 'ABC123', location_id: 'loc-1', name: 'Test',
  area_id: null, area_name: '', items: [], notes: '', tags: [],
  icon: 'Package', color: '', card_style: '', created_by: 'u1',
  created_by_name: 'U', visibility: 'location', custom_fields: {},
  created_at: '', updated_at: '',
};

const baseProps = {
  bin,
  canEdit: true,
  quickAdd: {} as never,
  dictation: {} as never,
  canTranscribe: false,
  aiEnabled: false,
  customFields: [],
  photos: [],
  checkouts: [],
  autoSave: {
    savedFields: new Set<never>(), savingFields: new Set<never>(),
    saveName: vi.fn(), saveNotes: vi.fn(), saveTags: vi.fn(),
    saveAreaId: vi.fn(), saveIcon: vi.fn(), saveColor: vi.fn(),
    saveCardStyle: vi.fn(), saveVisibility: vi.fn(), saveCustomFields: vi.fn(),
  } as never,
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('BinDetailTabs', () => {
  it('defaults to Contents tab', () => {
    render(<BinDetailTabs {...baseProps} />);
    expect(screen.getByTestId('tab-contents')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-photos')).toBeNull();
  });

  it('switches tabs and persists the selection', () => {
    render(<BinDetailTabs {...baseProps} />);
    fireEvent.click(screen.getByRole('tab', { name: /photos/i }));
    expect(screen.getByTestId('tab-photos')).toBeInTheDocument();
    expect(localStorage.getItem('openbin-detail-tab')).toBe('photos');
  });

  it('restores persisted tab on mount', () => {
    localStorage.setItem('openbin-detail-tab', 'information');
    render(<BinDetailTabs {...baseProps} />);
    expect(screen.getByTestId('tab-information')).toBeInTheDocument();
  });

  it('falls back to contents when a stale legacy tab value is persisted', () => {
    localStorage.setItem('openbin-detail-tab', 'activity');
    render(<BinDetailTabs {...baseProps} />);
    expect(screen.getByTestId('tab-contents')).toBeInTheDocument();
  });

  it('does not render an Appearance tab', () => {
    render(<BinDetailTabs {...baseProps} />);
    expect(screen.queryByRole('tab', { name: /appearance/i })).toBeNull();
  });

  it('remaps legacy persisted "appearance" value to contents', () => {
    localStorage.setItem('openbin-detail-tab', 'appearance');
    render(<BinDetailTabs {...baseProps} />);
    expect(screen.getByTestId('tab-contents')).toBeInTheDocument();
  });

  it('switches tabs via arrow keys', () => {
    render(<BinDetailTabs {...baseProps} />);
    const contents = screen.getByRole('tab', { name: /contents/i });
    contents.focus();
    fireEvent.keyDown(contents, { key: 'ArrowRight' });
    expect(screen.getByTestId('tab-photos')).toBeInTheDocument();
    expect(localStorage.getItem('openbin-detail-tab')).toBe('photos');
  });

  it('switches tabs via number key 2', () => {
    render(<BinDetailTabs {...baseProps} />);
    fireEvent.keyDown(window, { key: '2' });
    expect(screen.getByTestId('tab-photos')).toBeInTheDocument();
  });

  it('switches to Information tab via number key 3', () => {
    render(<BinDetailTabs {...baseProps} />);
    fireEvent.keyDown(window, { key: '3' });
    expect(screen.getByTestId('tab-information')).toBeInTheDocument();
  });

  it('does not bind number key 4 (Appearance tab removed)', () => {
    render(<BinDetailTabs {...baseProps} />);
    fireEvent.keyDown(window, { key: '4' });
    // Should remain on Contents
    expect(screen.getByTestId('tab-contents')).toBeInTheDocument();
  });
});
