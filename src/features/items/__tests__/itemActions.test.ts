import { describe, expect, it, vi } from 'vitest';
import { checkoutItemSafe, removeItemSafe, renameItemSafe, updateQuantitySafe } from '../itemActions';

vi.mock('@/features/checkouts/useCheckouts', () => ({
  checkoutItem: vi.fn(async () => ({ id: 'c1' })),
}));
vi.mock('@/features/bins/useBins', () => ({
  removeItemFromBin: vi.fn(async () => undefined),
  renameItem: vi.fn(async () => undefined),
  updateItemQuantity: vi.fn(async () => ({ id: 'i1', quantity: 3 })),
}));

describe('itemActions helpers', () => {
  it('checkoutItemSafe returns {ok: true} on success', async () => {
    const r = await checkoutItemSafe('bin1', 'item1');
    expect(r).toEqual({ ok: true });
  });

  it('removeItemSafe returns {ok: true} on success', async () => {
    const r = await removeItemSafe('bin1', 'item1');
    expect(r).toEqual({ ok: true });
  });

  it('renameItemSafe passes name and quantity through', async () => {
    const r = await renameItemSafe('bin1', 'item1', 'New name', 5);
    expect(r).toEqual({ ok: true });
  });

  it('updateQuantitySafe returns the new quantity', async () => {
    const r = await updateQuantitySafe('bin1', 'item1', 3);
    expect(r).toEqual({ ok: true, quantity: 3 });
  });
});
