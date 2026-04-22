import '@/features/print/print.css';
import { getAreaPath } from '@/features/areas/useAreas';
import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import { useTerminology } from '@/lib/terminology';
import type { Area } from '@/types';
import type { MoveListItem, SourceCard, SourceClusterRow } from './deriveMoveList';

interface MoveListSheetProps {
  sourceCards: SourceCard[];
  areas: Area[];
  totalItems: number;
  totalMoves: number;
  totalDestinationBins: number;
  summary?: string;
}

export function MoveListSheet({
  sourceCards,
  areas,
  totalItems,
  totalMoves,
  totalDestinationBins,
  summary,
}: MoveListSheetProps) {
  const t = useTerminology();

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
        {summary && <p className="move-list-summary">{summary}</p>}
      </div>

      {sourceCards.map((card) => (
        <MoveListSection key={card.sourceBin.id} card={card} areas={areas} />
      ))}
    </div>
  );
}

interface MoveListSectionProps {
  card: SourceCard;
  areas: Area[];
}

function MoveListSection({ card, areas }: MoveListSectionProps) {
  const bin = card.sourceBin;
  const Icon = bin.icon ? resolveIcon(bin.icon) : null;
  const colorPreset = bin.color ? resolveColor(bin.color) : undefined;
  const chipBg = colorPreset?.bg ?? '#e5e7eb';
  const areaPath = bin.area_id ? getAreaPath(bin.area_id, areas) : '';
  const itemTotal = card.outgoingClusters.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="item-sheet-bin">
      <div className="move-list-bin-header">
        <div className="move-list-bin-title-row">
          {Icon && (
            <span className="item-sheet-icon-chip" style={{ backgroundColor: chipBg }}>
              <Icon className="item-sheet-icon-glyph" />
            </span>
          )}
          <span className="item-sheet-bin-name">{bin.name}</span>
          <span
            className="move-list-bin-code"
            data-testid={`move-list-code-${bin.id}`}
          >
            {bin.short_code}
          </span>
        </div>
        <div className="item-sheet-header-meta-row">
          {areaPath && (
            <>
              <span className="item-sheet-area-path">{areaPath}</span>
              <span className="move-list-meta-sep" aria-hidden="true">·</span>
            </>
          )}
          <span className="item-sheet-item-count">
            {card.preserved ? 'will be kept' : 'will be emptied'}
          </span>
          <span className="move-list-meta-sep" aria-hidden="true">·</span>
          <span className="move-list-meta-count">
            {itemTotal} item{itemTotal !== 1 ? 's' : ''}
          </span>
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
  const itemCount = cluster.items.length;
  return (
    <div className="move-list-cluster" data-testid={`move-list-cluster-${binId}-${index}`}>
      <div className="move-list-cluster-header">
        <span className="move-list-arrow" aria-hidden="true">→</span>
        <span className="move-list-dest-pill">{cluster.destinationName}</span>
        <span className={cluster.destinationKept ? 'move-list-status-tag move-list-status-kept' : 'move-list-status-tag move-list-status-new'}>
          {cluster.destinationKept ? 'kept' : 'new'}
        </span>
        <span className="move-list-cluster-count">
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </span>
        {cluster.destinationTags.length > 0 && (
          <span className="move-list-cluster-tags">
            {cluster.destinationTags.map((tag, i) => (
              <span key={tag}>
                {i > 0 && <span aria-hidden="true">, </span>}
                {tag}
              </span>
            ))}
          </span>
        )}
      </div>
      <ul className="move-list-items">
        {cluster.items.map((item, itemIdx) => (
          <li className="move-list-item" key={`${item.name}-${itemIdx}`}>
            <span
              data-testid={`move-list-item-check-${binId}-${index}-${itemIdx}`}
              className="move-list-item-check"
              aria-hidden="true"
            />
            <span className="move-list-item-text">{formatItem(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatItem(item: MoveListItem): string {
  const qty = item.quantity != null && item.quantity !== 1 ? `${item.quantity}× ` : '';
  return `${qty}${item.name}`;
}
