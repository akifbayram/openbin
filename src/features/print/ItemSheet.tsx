import type { Bin } from '@/types';

interface ItemSheetProps {
  bins: Bin[];
  showCheckboxes: boolean;
  showQuantity: boolean;
  showBinCode: boolean;
}

export function ItemSheet({ bins, showCheckboxes, showQuantity, showBinCode }: ItemSheetProps) {
  if (bins.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-[var(--text-tertiary)] text-[13px]">
        No bins selected
      </div>
    );
  }

  return (
    <div className="item-sheet">
      {bins.map((bin) => (
        <div key={bin.id} className="item-sheet-bin">
          <div className="item-sheet-header">
            <span className="item-sheet-bin-name">{bin.name}</span>
            {showBinCode && (
              <span className="item-sheet-bin-code">{bin.short_code}</span>
            )}
          </div>
          {bin.items.length === 0 ? (
            <p className="item-sheet-empty">No items</p>
          ) : (
            <table className="item-sheet-table">
              <thead>
                <tr>
                  {showCheckboxes && <th className="item-sheet-checkbox-col" />}
                  <th className="item-sheet-name-col">Item</th>
                  {showQuantity && <th className="item-sheet-qty-col">Qty</th>}
                </tr>
              </thead>
              <tbody>
                {bin.items.map((item) => (
                  <tr key={item.id}>
                    {showCheckboxes && (
                      <td className="item-sheet-checkbox-col">
                        <div className="item-sheet-checkbox" />
                      </td>
                    )}
                    <td className="item-sheet-name-col">{item.name}</td>
                    {showQuantity && (
                      <td className="item-sheet-qty-col">
                        {item.quantity != null ? item.quantity : ''}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
