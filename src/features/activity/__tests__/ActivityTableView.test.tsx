import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ActivityLogEntry } from '@/types';
import { ActivityTableView } from '../ActivityTableView';

vi.mock('@/lib/terminology', () => ({
  useTerminology: () => ({
    bin: 'bin', bins: 'bins', Bin: 'Bin', Bins: 'Bins',
    area: 'area', areas: 'areas', Area: 'Area', Areas: 'Areas',
    location: 'location', locations: 'locations', Location: 'Location', Locations: 'Locations',
  }),
}));

function makeEntry(overrides: Partial<ActivityLogEntry> = {}): ActivityLogEntry {
  return {
    id: 'entry-1', location_id: 'loc-1', user_id: 'u1',
    user_name: 'user', display_name: 'Alex',
    action: 'update', entity_type: 'bin', entity_id: 'bin-123',
    entity_name: 'Kitchen Supplies', changes: null,
    auth_method: 'jwt', api_key_name: null,
    created_at: '2026-04-14T12:00:00Z',
    ...overrides,
  };
}

function renderWithRouter(ui: React.ReactNode, at = '/activity') {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/activity" element={ui} />
        <Route path="/bin/:id" element={<div>bin page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ActivityTableView', () => {
  it('shows "View bin" navigation link for bin entries when currentEntityId is not set', async () => {
    const user = userEvent.setup();
    const entry = makeEntry({ entity_id: 'bin-123', action: 'update' });
    renderWithRouter(
      <ActivityTableView
        entries={[entry]}
        hasMore={false}
        isLoadingMore={false}
        loadMore={() => {}}
        searchQuery=""
      />,
    );

    const [row] = screen.getAllByRole('button');
    await user.click(row);

    expect(await screen.findByRole('button', { name: /view bin/i })).toBeInTheDocument();
  });

  it('suppresses "View bin" link when entry.entity_id matches currentEntityId', async () => {
    const user = userEvent.setup();
    const entry = makeEntry({ entity_id: 'bin-123', action: 'update' });
    renderWithRouter(
      <ActivityTableView
        entries={[entry]}
        hasMore={false}
        isLoadingMore={false}
        loadMore={() => {}}
        searchQuery=""
        currentEntityId="bin-123"
      />,
    );

    const [row] = screen.getAllByRole('button');
    await user.click(row);

    expect(screen.queryByRole('button', { name: /view bin/i })).toBeNull();
  });

  it('still shows "View bin" link for entries whose entity_id does not match currentEntityId', async () => {
    const user = userEvent.setup();
    const entry = makeEntry({ entity_id: 'bin-999', action: 'update' });
    renderWithRouter(
      <ActivityTableView
        entries={[entry]}
        hasMore={false}
        isLoadingMore={false}
        loadMore={() => {}}
        searchQuery=""
        currentEntityId="bin-123"
      />,
    );

    const [row] = screen.getAllByRole('button');
    await user.click(row);

    expect(await screen.findByRole('button', { name: /view bin/i })).toBeInTheDocument();
  });

  it('renders chips for each changed field on a bin update entry', () => {
    const entry = makeEntry({
      action: 'update',
      entity_id: 'bin-123',
      changes: {
        notes: { old: 'A', new: 'B' },
        tags: { old: [], new: ['x'] },
        color: { old: 'red', new: 'blue' },
      },
    });
    renderWithRouter(
      <ActivityTableView
        entries={[entry]}
        hasMore={false}
        isLoadingMore={false}
        loadMore={() => {}}
        searchQuery=""
      />,
    );

    expect(screen.getByText('notes')).toBeInTheDocument();
    expect(screen.getByText('tags')).toBeInTheDocument();
    expect(screen.getByText('color')).toBeInTheDocument();
  });

  it('caps chips at 4 and appends a "+N more" overflow chip', () => {
    const entry = makeEntry({
      action: 'update',
      entity_id: 'bin-123',
      changes: {
        name: { old: 'a', new: 'b' },
        notes: { old: 'x', new: 'y' },
        tags: { old: [], new: ['t'] },
        icon: { old: 'i1', new: 'i2' },
        color: { old: 'red', new: 'blue' },
        visibility: { old: 'location', new: 'private' },
      },
    });
    renderWithRouter(
      <ActivityTableView
        entries={[entry]}
        hasMore={false}
        isLoadingMore={false}
        loadMore={() => {}}
        searchQuery=""
      />,
    );

    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('notes')).toBeInTheDocument();
    expect(screen.getByText('tags')).toBeInTheDocument();
    expect(screen.getByText('icon')).toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
    expect(screen.queryByText('color')).toBeNull();
    expect(screen.queryByText('visibility')).toBeNull();
  });

  it('renders no chips for a non-update entry', () => {
    const entry = makeEntry({ action: 'create', entity_id: 'bin-123', changes: null });
    renderWithRouter(
      <ActivityTableView
        entries={[entry]}
        hasMore={false}
        isLoadingMore={false}
        loadMore={() => {}}
        searchQuery=""
      />,
    );

    expect(screen.queryByText('notes')).toBeNull();
    expect(screen.queryByText('tags')).toBeNull();
  });
});
