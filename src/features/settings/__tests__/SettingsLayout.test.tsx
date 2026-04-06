import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsLayout } from '../SettingsLayout';

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(() => ({ user: { id: '1', username: 'test', isAdmin: false }, activeLocationId: 'loc-1', token: 't' })),
}));

vi.mock('@/lib/usePermissions', () => ({
  usePermissions: vi.fn(() => ({ isAdmin: true, canWrite: true })),
}));

vi.mock('@/features/locations/useLocations', () => ({
  useLocationList: vi.fn(() => ({
    locations: [{ id: 'loc-1', role: 'admin' }],
    isLoading: false,
  })),
}));

function setDesktop(desktop: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: desktop,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderSettings(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/settings" element={<SettingsLayout />}>
          <Route path="account" element={<div data-testid="account-content">Account Page</div>} />
          <Route path="preferences" element={<div data-testid="preferences-content">Preferences Page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('SettingsLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('desktop: /settings redirects to /settings/account', () => {
    setDesktop(true);
    renderSettings('/settings');
    expect(screen.getByTestId('account-content')).toBeTruthy();
  });

  it('mobile: /settings shows category list', () => {
    setDesktop(false);
    renderSettings('/settings');
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Preferences')).toBeTruthy();
    expect(screen.queryByTestId('account-content')).toBeNull();
  });

  it('mobile: /settings/account shows content', () => {
    setDesktop(false);
    renderSettings('/settings/account');
    expect(screen.getByTestId('account-content')).toBeTruthy();
  });

  it('desktop: shows sidebar nav with aria-label', () => {
    setDesktop(true);
    renderSettings('/settings/account');
    expect(screen.getByRole('navigation', { name: 'Settings' })).toBeTruthy();
  });
});
