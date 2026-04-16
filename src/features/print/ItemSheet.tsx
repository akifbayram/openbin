import { useEffect, useState } from 'react';
import { getAreaPath } from '@/features/areas/useAreas';
import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import { cn } from '@/lib/utils';
import type { Area, Bin } from '@/types';
import { generateItemSheetQrMap } from './itemSheetQr';
import type { ItemListOptions, QrStyleOptions } from './usePrintSettings';

interface ItemSheetProps extends ItemListOptions {
  bins: Bin[];
  areas: Area[];
  qrStyle: QrStyleOptions;
}

const QR_PIXEL_SIZE = 192; // 2x the ~1in display target for crispness

export function ItemSheet({
  bins,
  areas,
  qrStyle,
  showQrCode,
  showIcon,
  showAreaPath,
  showBinCode,
  showItemCount,
  showCheckboxes,
  showQuantity,
  showNotesColumn,
  showBinNotes,
  zebraStripes,
  blankRowCount,
}: ItemSheetProps) {
  const [qrMap, setQrMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  const qrStyleKey = JSON.stringify(qrStyle);
  const binIdsKey = bins.map((b) => b.id).join(',');

  // biome-ignore lint/correctness/useExhaustiveDependencies: binIdsKey/qrStyleKey are stable string digests of bins/qrStyle — using the primitives avoids array/object identity churn
  useEffect(() => {
    if (!showQrCode || bins.length === 0) {
      setQrMap(new Map());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    generateItemSheetQrMap(bins.map((b) => b.id), QR_PIXEL_SIZE, qrStyle)
      .then((result) => {
        if (!cancelled) {
          setQrMap(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrMap(new Map());
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [binIdsKey, qrStyleKey, showQrCode]);

  if (bins.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-[var(--text-tertiary)] text-[13px]">
        No bins selected
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-[var(--text-tertiary)] text-[13px]">
        Generating…
      </div>
    );
  }

  return (
    <div className="item-sheet">
      {bins.map((bin) => (
        <BinSection
          key={bin.id}
          bin={bin}
          areas={areas}
          qrDataUrl={qrMap.get(bin.id) ?? ''}
          showQrCode={showQrCode}
          showIcon={showIcon}
          showAreaPath={showAreaPath}
          showBinCode={showBinCode}
          showItemCount={showItemCount}
          showCheckboxes={showCheckboxes}
          showQuantity={showQuantity}
          showNotesColumn={showNotesColumn}
          showBinNotes={showBinNotes}
          zebraStripes={zebraStripes}
          blankRowCount={blankRowCount}
        />
      ))}
    </div>
  );
}

interface BinSectionProps extends ItemListOptions {
  bin: Bin;
  areas: Area[];
  qrDataUrl: string;
}

function BinSection({
  bin,
  areas,
  qrDataUrl,
  showQrCode,
  showIcon,
  showAreaPath,
  showBinCode,
  showItemCount,
  showCheckboxes,
  showQuantity,
  showNotesColumn,
  showBinNotes,
  zebraStripes,
  blankRowCount,
}: BinSectionProps) {
  const Icon = showIcon && bin.icon ? resolveIcon(bin.icon) : null;
  const colorPreset = bin.color ? resolveColor(bin.color) : undefined;
  const chipBg = colorPreset?.bg ?? '#e5e7eb';

  const areaPath = showAreaPath && bin.area_id ? getAreaPath(bin.area_id, areas) : '';
  const itemCount = bin.items.length;
  const itemCountLabel = itemCount === 1 ? '1 item' : `${itemCount} items`;

  const hasItems = itemCount > 0;
  const showTable = hasItems || blankRowCount > 0;
  const showEmptyPlaceholder = !hasItems && blankRowCount === 0;

  const notesIsVisible = showBinNotes && bin.notes.trim().length > 0;

  return (
    <div className="item-sheet-bin">
      <div className="item-sheet-header-grid">
        <div className="item-sheet-header-left">
          <div className="item-sheet-header-title-row">
            {Icon && (
              <span
                data-testid={`item-sheet-icon-${bin.id}`}
                className="item-sheet-icon-chip"
                style={{ backgroundColor: chipBg }}
              >
                <Icon className="item-sheet-icon-glyph" />
              </span>
            )}
            <span className="item-sheet-bin-name">{bin.name}</span>
          </div>
          {(areaPath || showItemCount) && (
            <div className="item-sheet-header-meta-row">
              {areaPath && (
                <span data-testid="item-sheet-area-path" className="item-sheet-area-path">
                  {areaPath}
                </span>
              )}
              {showItemCount && (
                <span className="item-sheet-item-count">{itemCountLabel}</span>
              )}
            </div>
          )}
        </div>
        {(showQrCode || showBinCode) && (
          <div className="item-sheet-header-right">
            {showQrCode && qrDataUrl && (
              <img
                data-testid={`item-sheet-qr-${bin.id}`}
                className="item-sheet-qr"
                src={qrDataUrl}
                alt=""
              />
            )}
            {showBinCode && (
              <span className="item-sheet-bin-code">{bin.short_code}</span>
            )}
          </div>
        )}
      </div>

      {notesIsVisible && (
        <p
          data-testid={`item-sheet-bin-notes-${bin.id}`}
          className="item-sheet-bin-notes"
        >
          {bin.notes}
        </p>
      )}

      {showEmptyPlaceholder && (
        <p className="item-sheet-empty">No items</p>
      )}

      {showTable && (
        <table className="item-sheet-table">
          <thead>
            <tr>
              {showCheckboxes && <th className="item-sheet-checkbox-col" />}
              <th className="item-sheet-name-col">Item</th>
              {showQuantity && <th className="item-sheet-qty-col">Qty</th>}
              {showNotesColumn && <th className="item-sheet-notes-col">Notes</th>}
            </tr>
          </thead>
          <tbody>
            {bin.items.map((item, idx) => (
              <tr
                key={item.id}
                className={cn(zebraStripes && idx % 2 === 1 && 'item-sheet-zebra')}
              >
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
                {showNotesColumn && <td className="item-sheet-notes-col" />}
              </tr>
            ))}
            {Array.from({ length: blankRowCount }).map((_, idx) => {
              const rowIdx = bin.items.length + idx;
              return (
                <tr
                  // biome-ignore lint/suspicious/noArrayIndexKey: order is stable
                  key={`blank-${idx}`}
                  className={cn(
                    'item-sheet-blank-row',
                    zebraStripes && rowIdx % 2 === 1 && 'item-sheet-zebra',
                  )}
                >
                  {showCheckboxes && (
                    <td className="item-sheet-checkbox-col">
                      <div className="item-sheet-checkbox" />
                    </td>
                  )}
                  <td className="item-sheet-name-col" />
                  {showQuantity && <td className="item-sheet-qty-col" />}
                  {showNotesColumn && <td className="item-sheet-notes-col" />}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
