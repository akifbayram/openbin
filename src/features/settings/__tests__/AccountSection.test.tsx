import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/lib/auth';
import { AccountSection } from '../sections/AccountSection';

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(() => Promise.resolve({ results: [] })),
  getAvatarUrl: vi.fn((url: string) => url),
}));

vi.mock('@/features/locations/useLocations', () => ({
  useLocationList: vi.fn(() => ({ locations: [], isLoading: false })),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: vi.fn(() => ({ showToast: vi.fn() })),
}));

vi.mock('@/lib/usePlan', () => ({
  usePlan: () => ({
    isGated: () => false,
    isSelfHosted: true,
    planInfo: null,
  }),
}));

vi.mock('../useApiKeys', () => ({
  useApiKeys: vi.fn(() => ({ keys: [], isLoading: false })),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
}));

const baseUser = {
  id: '1',
  displayName: 'Test User',
  email: 'test@example.com',
  avatarUrl: null,
  createdAt: '2025-01-01T00:00:00Z',
};

function mockAuth(overrides: Record<string, unknown> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    user: { ...baseUser, hasPassword: false, ...overrides },
    updateUser: vi.fn(),
    deleteAccount: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

function renderAccountSection() {
  return render(
    <MemoryRouter>
      <AccountSection />
    </MemoryRouter>,
  );
}

describe('AccountSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ oauthProviders: [] }) } as Response),
    );
  });

  it('hides password section for OAuth-only users', () => {
    mockAuth({ hasPassword: false });
    renderAccountSection();
    expect(screen.queryByLabelText('Current Password')).toBeNull();
    expect(screen.queryByLabelText('New Password')).toBeNull();
  });

  it('shows password section for password users', () => {
    mockAuth({ hasPassword: true });
    renderAccountSection();
    expect(screen.getByLabelText('Current Password')).toBeTruthy();
    expect(screen.getByLabelText('New Password')).toBeTruthy();
  });

  it('shows delete account button for OAuth-only users', () => {
    mockAuth({ hasPassword: false });
    renderAccountSection();
    expect(screen.getByText('Delete Account')).toBeTruthy();
  });
});
