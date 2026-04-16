import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ITEM_LIST_OPTIONS,
  DEFAULT_NAME_CARD_OPTIONS,
  DEFAULT_PRINT_SETTINGS,
  mergeLoadedSettings,
} from '../usePrintSettings';

describe('mergeLoadedSettings', () => {
  it('fills new ItemListOptions defaults when persisted data only has the legacy fields', () => {
    const legacy = {
      itemListOptions: { showCheckboxes: false, showQuantity: false, showBinCode: false },
    };
    const merged = mergeLoadedSettings(legacy as Partial<typeof DEFAULT_PRINT_SETTINGS>);
    // Legacy fields preserved
    expect(merged.itemListOptions?.showCheckboxes).toBe(false);
    expect(merged.itemListOptions?.showQuantity).toBe(false);
    expect(merged.itemListOptions?.showBinCode).toBe(false);
    // New fields get defaults (all true)
    expect(merged.itemListOptions?.showQrCode).toBe(true);
    expect(merged.itemListOptions?.showIcon).toBe(true);
    expect(merged.itemListOptions?.showAreaPath).toBe(true);
    expect(merged.itemListOptions?.showItemCount).toBe(true);
    expect(merged.itemListOptions?.showNotesColumn).toBe(true);
    expect(merged.itemListOptions?.showBinNotes).toBe(true);
    expect(merged.itemListOptions?.zebraStripes).toBe(true);
    expect(merged.itemListOptions?.blankRowCount).toBe(5);
  });

  it('fills NameCardOptions defaults when persisted data has partial shape', () => {
    const partial = { nameCardOptions: { showIcon: false } };
    const merged = mergeLoadedSettings(partial as Partial<typeof DEFAULT_PRINT_SETTINGS>);
    expect(merged.nameCardOptions?.showIcon).toBe(false);
    expect(merged.nameCardOptions?.showColor).toBe(DEFAULT_NAME_CARD_OPTIONS.showColor);
    expect(merged.nameCardOptions?.sizingMode).toBe(DEFAULT_NAME_CARD_OPTIONS.sizingMode);
    expect(merged.nameCardOptions?.fontScale).toBe(DEFAULT_NAME_CARD_OPTIONS.fontScale);
  });

  it('returns full defaults when data is empty', () => {
    const merged = mergeLoadedSettings({});
    expect(merged.itemListOptions).toEqual(DEFAULT_ITEM_LIST_OPTIONS);
    expect(merged.nameCardOptions).toEqual(DEFAULT_NAME_CARD_OPTIONS);
    expect(merged.formatKey).toBe(DEFAULT_PRINT_SETTINGS.formatKey);
  });
});
