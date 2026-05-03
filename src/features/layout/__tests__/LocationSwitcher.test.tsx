import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Location } from '@/types';
import { LocationSwitcher } from '../LocationSwitcher';

function makeLocation(
  id: string,
  name: string,
  role: 'admin' | 'member' | 'viewer' = 'member',
): Location {
  return {
    id,
    name,
    role,
    created_by: 'u1',
    invite_code: 'ABC',
    activity_retention_days: 90,
    trash_retention_days: 30,
    app_name: 'OpenBin',
    term_bin: 'Bin',
    term_location: 'Location',
    term_area: 'Area',
    default_join_role: 'member',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

describe('LocationSwitcher', () => {
  it('renders nothing with zero locations', () => {
    const { container } = render(
      <LocationSwitcher locations={[]} activeLocationId={null} onLocationChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing with a single location', () => {
    const { container } = render(
      <LocationSwitcher
        locations={[makeLocation('1', 'Home')]}
        activeLocationId="1"
        onLocationChange={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a dropdown trigger (not an instant-swap) at two locations', () => {
    render(
      <LocationSwitcher
        locations={[makeLocation('1', 'Home'), makeLocation('2', 'Garage')]}
        activeLocationId="1"
        onLocationChange={() => {}}
      />,
    );
    const trigger = screen.getByRole('button', { name: /switch location/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the location count badge when 2+ locations', () => {
    render(
      <LocationSwitcher
        locations={[makeLocation('1', 'A'), makeLocation('2', 'B'), makeLocation('3', 'C')]}
        activeLocationId="1"
        onLocationChange={() => {}}
      />,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('fires onLocationChange when a different location is selected', () => {
    const onChange = vi.fn();
    render(
      <LocationSwitcher
        locations={[makeLocation('1', 'Home'), makeLocation('2', 'Garage')]}
        activeLocationId="1"
        onLocationChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /switch location/i }));
    fireEvent.click(screen.getByRole('option', { name: /garage/i }));
    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('Escape closes the dropdown without firing onLocationChange', () => {
    const onChange = vi.fn();
    render(
      <LocationSwitcher
        locations={[makeLocation('1', 'Home'), makeLocation('2', 'Garage')]}
        activeLocationId="1"
        onLocationChange={onChange}
      />,
    );
    const trigger = screen.getByRole('button', { name: /switch location/i });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(onChange).not.toHaveBeenCalled();
  });
});
