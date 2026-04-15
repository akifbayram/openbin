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
});
