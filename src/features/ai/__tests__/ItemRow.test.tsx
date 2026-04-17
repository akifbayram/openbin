import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemRow } from '../ItemRow';

const mockShowToast = vi.fn();
const mockCheckoutItemSafe = vi.fn().mockResolvedValue({ ok: true });
const mockRemoveItemSafe = vi.fn().mockResolvedValue({ ok: true });
const mockRenameItemSafe = vi.fn().mockResolvedValue({ ok: true });
const mockUpdateQuantitySafe = vi.fn().mockResolvedValue({ ok: true, quantity: 5 });
const mockRestoreBinFromTrash = vi.fn().mockResolvedValue({ id: 'b1' });

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('@/features/items/itemActions', () => ({
  checkoutItemSafe: (...args: unknown[]) => mockCheckoutItemSafe(...args),
  removeItemSafe: (...args: unknown[]) => mockRemoveItemSafe(...args),
  renameItemSafe: (...args: unknown[]) => mockRenameItemSafe(...args),
  updateQuantitySafe: (...args: unknown[]) => mockUpdateQuantitySafe(...args),
}));

vi.mock('@/features/bins/useBins', () => ({
  restoreBinFromTrash: (...args: unknown[]) => mockRestoreBinFromTrash(...args),
}));

const baseItem = { id: 'i1', name: 'Tent', quantity: null };

function renderRow(props: Partial<Parameters<typeof ItemRow>[0]> = {}) {
  return render(
    <MemoryRouter>
      <ItemRow item={baseItem} binId="b1" {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckoutItemSafe.mockResolvedValue({ ok: true });
  mockRemoveItemSafe.mockResolvedValue({ ok: true });
  mockRenameItemSafe.mockResolvedValue({ ok: true });
  mockUpdateQuantitySafe.mockResolvedValue({ ok: true, quantity: 5 });
  mockRestoreBinFromTrash.mockResolvedValue({ id: 'b1' });
});

describe('ItemRow (display)', () => {
  it('renders the item name', () => {
    renderRow();
    expect(screen.getByText('Tent')).toBeDefined();
  });

  it('renders the quantity badge when quantity is set', () => {
    renderRow({ item: { ...baseItem, quantity: 4 } });
    expect(screen.getByText(/×\s*4/)).toBeDefined();
  });

  it('does not render a quantity badge when quantity is null', () => {
    const { container } = renderRow();
    expect(container.textContent).not.toMatch(/×/);
  });
});

describe('ItemRow — Open bin action', () => {
  it('calls onOpenBin with binId when Open bin is selected from menu', async () => {
    const onOpenBin = vi.fn();
    renderRow({ onOpenBin });
    await userEvent.click(screen.getByRole('button', { name: /item actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /open bin/i }));
    expect(onOpenBin).toHaveBeenCalledWith('b1');
  });
});

describe('ItemRow — Checkout action', () => {
  it('calls checkoutItemSafe when Checkout is selected', async () => {
    renderRow({ canWrite: true });
    await userEvent.click(screen.getByRole('button', { name: /item actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /checkout/i }));
    await waitFor(() => {
      expect(mockCheckoutItemSafe).toHaveBeenCalledWith('b1', 'i1');
    });
  });

  it('does not show write actions when canWrite is false', async () => {
    renderRow({ canWrite: false });
    await userEvent.click(screen.getByRole('button', { name: /item actions/i }));
    expect(screen.queryByRole('menuitem', { name: /checkout/i })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /rename/i })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /remove/i })).toBeNull();
  });
});

describe('ItemRow — Remove action with confirm dialog', () => {
  it('shows confirm dialog before removing', async () => {
    renderRow({ canWrite: true });
    await userEvent.click(screen.getByRole('button', { name: /item actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /remove/i }));
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/remove item/i)).toBeDefined();
  });

  it('calls removeItemSafe after confirming in dialog', async () => {
    renderRow({ canWrite: true });
    await userEvent.click(screen.getByRole('button', { name: /item actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /remove/i }));
    await userEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    await waitFor(() => {
      expect(mockRemoveItemSafe).toHaveBeenCalledWith('b1', 'i1');
    });
  });

  it('cancels removal when Cancel is clicked', async () => {
    renderRow({ canWrite: true });
    await userEvent.click(screen.getByRole('button', { name: /item actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /remove/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockRemoveItemSafe).not.toHaveBeenCalled();
  });
});

describe('ItemRow — Inline rename', () => {
  it('picking Rename swaps the row to an input with aria-label "Item name"', async () => {
    renderRow({ canWrite: true });
    await userEvent.click(screen.getByRole('button', { name: /item actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /rename/i }));
    const input = screen.getByRole('textbox', { name: /item name/i });
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).value).toBe('Tent');
  });

  it('calls renameItemSafe on Enter', async () => {
    renderRow({ canWrite: true });
    await userEvent.click(screen.getByRole('button', { name: /item actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /rename/i }));
    const input = screen.getByRole('textbox', { name: /item name/i });
    await userEvent.clear(input);
    await userEvent.type(input, 'Shelter');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(mockRenameItemSafe).toHaveBeenCalledWith('b1', 'i1', 'Shelter');
    });
  });

  it('Escape cancels rename without saving', async () => {
    renderRow({ canWrite: true });
    await userEvent.click(screen.getByRole('button', { name: /item actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /rename/i }));
    const input = screen.getByRole('textbox', { name: /item name/i });
    await userEvent.type(input, ' Extra');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(mockRenameItemSafe).not.toHaveBeenCalled();
    expect(screen.getByText('Tent')).toBeDefined();
  });
});

describe('ItemRow — Inline quantity stepper', () => {
  it('picking Adjust quantity reveals a Quantity input', async () => {
    const itemWithQty = { id: 'i1', name: 'Tent', quantity: 3 };
    render(
      <MemoryRouter>
        <ItemRow item={itemWithQty} binId="b1" canWrite={true} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /item actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /adjust quantity/i }));
    const input = screen.getByRole('spinbutton', { name: /quantity/i });
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).value).toBe('3');
  });

  it('Increment button increases quantity draft', async () => {
    const itemWithQty = { id: 'i1', name: 'Tent', quantity: 3 };
    render(
      <MemoryRouter>
        <ItemRow item={itemWithQty} binId="b1" canWrite={true} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /item actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /adjust quantity/i }));
    await userEvent.click(screen.getByRole('button', { name: /increment/i }));
    const input = screen.getByRole('spinbutton', { name: /quantity/i });
    expect((input as HTMLInputElement).value).toBe('4');
  });

  it('Decrement button decreases quantity draft', async () => {
    const itemWithQty = { id: 'i1', name: 'Tent', quantity: 3 };
    render(
      <MemoryRouter>
        <ItemRow item={itemWithQty} binId="b1" canWrite={true} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /item actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /adjust quantity/i }));
    await userEvent.click(screen.getByRole('button', { name: /decrement/i }));
    const input = screen.getByRole('spinbutton', { name: /quantity/i });
    expect((input as HTMLInputElement).value).toBe('2');
  });

  it('does not call updateQuantitySafe when quantity unchanged', async () => {
    const itemWithQty = { id: 'i1', name: 'Tent', quantity: 3 };
    render(
      <MemoryRouter>
        <ItemRow item={itemWithQty} binId="b1" canWrite={true} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /item actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /adjust quantity/i }));
    const input = screen.getByRole('spinbutton', { name: /quantity/i });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      // quantity unchanged (3 === 3), so should not be called
      expect(mockUpdateQuantitySafe).not.toHaveBeenCalled();
    });
  });
});

describe('ItemRow — Restore action', () => {
  it('invokes restoreBinFromTrash and navigates when Restore & open is chosen', async () => {
    renderRow({ isTrashed: true });
    await userEvent.click(screen.getByRole('button', { name: /item actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /restore/i }));
    await waitFor(() => {
      expect(mockRestoreBinFromTrash).toHaveBeenCalledWith('b1');
    });
  });

  it('shows error toast when restoreBinFromTrash fails', async () => {
    mockRestoreBinFromTrash.mockRejectedValueOnce(new Error('Not found'));
    renderRow({ isTrashed: true });
    await userEvent.click(screen.getByRole('button', { name: /item actions/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /restore/i }));
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error' }),
      );
    });
  });
});
