import { useEffect, useState } from 'react';
import '@/features/print/print.css';
import { getAreaPath } from '@/features/areas/useAreas';
import { generateItemSheetQrMap } from '@/features/print/itemSheetQr';
import type { QrStyleOptions } from '@/features/print/usePrintSettings';
import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import { useTerminology } from '@/lib/terminology';
import type { Area } from '@/types';
import type { MoveListItem, SourceCard, SourceClusterRow } from './deriveMoveList';

const QR_PIXEL_SIZE = 192;

interface MoveListSheetProps {
  sourceCards: SourceCard[];
  areas: Area[];
  qrStyle: QrStyleOptions;
  totalItems: number;
  totalMoves: number;
  totalDestinationBins: number;
}

export function MoveListSheet({
  sourceCards,
  areas,
  qrStyle,
  totalItems,
  totalMoves,
  totalDestinationBins,
}: MoveListSheetProps) {
  const t = useTerminology();
  const [qrMap, setQrMap] = useState<Map<string, string>>(new Map());
  const binIdsKey = sourceCards.map((c) => c.sourceBin.id).join(',');
  const qrStyleKey = JSON.stringify(qrStyle);

  // biome-ignore lint/correctness/useExhaustiveDependencies: stable string digests
  useEffect(() => {
    if (sourceCards.length === 0) {
      setQrMap(new Map());
      return;
    }
    let cancelled = false;
    generateItemSheetQrMap(sourceCards.map((c) => c.sourceBin.id), QR_PIXEL_SIZE, qrStyle)
      .then((map) => {
        if (!cancelled) setQrMap(map);
      })
      .catch(() => {
        if (!cancelled) setQrMap(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [binIdsKey, qrStyleKey]);

  if (sourceCards.length === 0) {
    return (
      <div className="item-sheet-empty">No source {t.bins} selected</div>
    );
  }

  return (
    <div className="item-sheet">
      <div className="move-list-header">
        <div className="move-list-title-row">
          <span className="move-list-title">Move List</span>
          <span className="move-list-date">{new Date().toLocaleDateString()}</span>
        </div>
        <div className="move-list-counts">
          {sourceCards.length} → {totalDestinationBins} {totalDestinationBins === 1 ? t.bin : t.bins} · {totalItems} item{totalItems !== 1 ? 's' : ''} · {totalMoves} move{totalMoves !== 1 ? 's' : ''}
        </div>
      </div>

      {sourceCards.map((card) => (
        <MoveListSection
          key={card.sourceBin.id}
          card={card}
          areas={areas}
          qrDataUrl={qrMap.get(card.sourceBin.id) ?? ''}
        />
      ))}
    </div>
  );
}

interface MoveListSectionProps {
  card: SourceCard;
  areas: Area[];
  qrDataUrl: string;
}

function MoveListSection({ card, areas, qrDataUrl }: MoveListSectionProps) {
  const bin = card.sourceBin;
  const Icon = bin.icon ? resolveIcon(bin.icon) : null;
  const colorPreset = bin.color ? resolveColor(bin.color) : undefined;
  const chipBg = colorPreset?.bg ?? '#e5e7eb';
  const areaPath = bin.area_id ? getAreaPath(bin.area_id, areas) : '';

  return (
    <div className="item-sheet-bin">
      <div className="item-sheet-header-grid">
        <div className="item-sheet-header-left">
          <div className="item-sheet-header-title-row">
            {Icon && (
              <span className="item-sheet-icon-chip" style={{ backgroundColor: chipBg }}>
                <Icon className="item-sheet-icon-glyph" />
              </span>
            )}
            <span className="item-sheet-bin-name">{bin.name}</span>
          </div>
          <div className="item-sheet-header-meta-row">
            {areaPath && <span className="item-sheet-area-path">{areaPath}</span>}
            <span className="item-sheet-item-count">
              {card.preserved ? 'will be kept' : 'will be emptied'}
            </span>
          </div>
        </div>
        <div className="item-sheet-header-right">
          {qrDataUrl && (
            <img
              data-testid={`move-list-qr-${bin.id}`}
              className="item-sheet-qr"
              src={qrDataUrl}
              alt=""
            />
          )}
          <span className="item-sheet-bin-code">{bin.short_code}</span>
        </div>
      </div>

      <div className="move-list-clusters">
        {card.outgoingClusters.map((cluster, idx) => (
          <MoveListCluster
            key={cluster.destinationName}
            cluster={cluster}
            binId={bin.id}
            index={idx}
          />
        ))}
      </div>
    </div>
  );
}

function MoveListCluster({
  cluster,
  binId,
  index,
}: {
  cluster: SourceClusterRow;
  binId: string;
  index: number;
}) {
  return (
    <div className="item-sheet-move-group">
      <div
        data-testid={`move-list-cluster-check-${binId}-${index}`}
        className="item-sheet-checkbox"
      />
      <div className="move-list-cluster-body">
        <div className="move-list-cluster-header">
          <span className="move-list-dest-pill">{cluster.destinationName}</span>
          <span className="move-list-new-tag">{cluster.destinationKept ? 'kept' : 'new'}</span>
        </div>
        <div className="move-list-cluster-items">{renderItemList(cluster.items)}</div>
      </div>
    </div>
  );
}

function renderItemList(items: MoveListItem[]): string {
  return items
    .map((item) => {
      const qty = item.quantity != null && item.quantity !== 1 ? `${item.quantity} ` : '';
      return `${qty}${item.name}`;
    })
    .join(', ');
}
