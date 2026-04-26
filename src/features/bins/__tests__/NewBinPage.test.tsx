import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setCapturedPhotos, setCapturedReturnTarget } from '@/features/capture/capturedPhotos';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', displayName: 'U', email: 'u@x', avatarUrl: null, createdAt: '', updatedAt: '' } }),
}));
vi.mock('@/features/locations/useLocations', () => ({
  useActiveLocation: () => ({ id: 'loc-1', name: 'Home', term_bin: 'bin' }),
}));

vi.mock('@/features/bins/BinCreateForm', () => ({
  BinCreateForm: (props: { initialPhotos: File[] | null; initialGroups: number[] | null }) => (
    <div data-testid="bin-create-form">
      photos:{props.initialPhotos?.length ?? 0} groups:{props.initialGroups?.length ?? 0}
    </div>
  ),
}));

import { NewBinPage } from '../NewBinPage';

afterEach(() => {
  navigateMock.mockReset();
  setCapturedReturnTarget(null);
});

describe('NewBinPage', () => {
  it('renders BinCreateForm with no initial photos by default', () => {
    render(
      <MemoryRouter initialEntries={['/new-bin']}>
        <Routes><Route path="/new-bin" element={<NewBinPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('bin-create-form')).toHaveTextContent('photos:0 groups:0');
  });

  it('auto-navigates to /capture when ?camera=open is present', async () => {
    render(
      <MemoryRouter initialEntries={['/new-bin?camera=open']}>
        <Routes><Route path="/new-bin" element={<NewBinPage />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/capture', expect.anything()));
  });

  it('forwards captured photos and groups to BinCreateForm', () => {
    const files = [
      new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
    ];
    setCapturedPhotos(files, [0, 1]);
    setCapturedReturnTarget('bin-create');

    render(
      <MemoryRouter initialEntries={['/new-bin']}>
        <Routes><Route path="/new-bin" element={<NewBinPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('bin-create-form')).toHaveTextContent('photos:2 groups:2');
  });
});
