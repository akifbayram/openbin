import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AiTurnQueryResult } from '../AiTurnQueryResult';

vi.mock('@/lib/usePermissions', () => ({
  usePermissions: () => ({ canWrite: false }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('@/features/items/itemActions', () => ({
  checkoutItemSafe: vi.fn().mockResolvedValue({ ok: true }),
  removeItemSafe: vi.fn().mockResolvedValue({ ok: true }),
  renameItemSafe: vi.fn().mockResolvedValue({ ok: true }),
  updateQuantitySafe: vi.fn().mockResolvedValue({ ok: true, quantity: null }),
}));

describe('AiTurnQueryResult', () => {
  it('renders the answer within a flat-card', () => {
    const { container } = render(
      <MemoryRouter>
        <AiTurnQueryResult
          queryResult={{ answer: 'Found it', matches: [] }}
          onBinClick={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Found it')).toBeDefined();
    expect((container.firstChild as HTMLElement).className).toContain('flat-card');
  });

  it('does not render a follow-up textarea or Back button', () => {
    render(
      <MemoryRouter>
        <AiTurnQueryResult
          queryResult={{ answer: '', matches: [] }}
          onBinClick={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });
});
