import { Lightbulb, Loader2, Package, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DEFAULT_QR_STYLE } from '@/features/print/usePrintSettings';
import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import { useTerminology } from '@/lib/terminology';
import type { Area, Bin } from '@/types';
import { deriveMoveList, type MoveListItem, type SourceCard } from './deriveMoveList';
import { MoveListSheet } from './MoveListSheet';
import type { PartialReorgResult } from './parsePartialReorg';
import type { ReorgResponse } from './useReorganize';

const COLLAPSED_ITEM_LIMIT = 5;

interface ReorganizePreviewProps {
  inputBins: Bin[];
  result: ReorgResponse | null;
  partialResult: PartialReorgResult;
  isStreaming: boolean;
  isApplying: boolean;
  areas: Area[];
  onAccept: () => void;
  onCancel: () => void;
  onRegenerate: () => void;
  onPrint?: () => void;
}

export function ReorganizePreview({
  inputBins,
  result,
  partialResult,
  isStreaming,
  isApplying,
  areas,
  onAccept,
  onCancel,
  onRegenerate,
  onPrint,
}: ReorganizePreviewProps) {
  const t = useTerminology();
  const source = result ?? partialResult;
  const derivation = useMemo(() => deriveMoveList(inputBins, source), [inputBins, source]);
  const summary = result?.summary ?? partialResult.summary;
  const hasContent = derivation.sourceCards.some((s) => s.outgoingClusters.length > 0);

  if (!hasContent && !isStreaming) return null;

  const { sourceCards, totalDestinationBins, totalItems, totalMoves } = derivation;
  const originalCount = inputBins.length;

  return (
    <div className="space-y-4">
      <div className="row-spread">
        <Label className="text-[15px] font-semibold text-[var(--text-primary)]">
          Proposal
        </Label>
        <span className="text-[12px] text-[var(--text-tertiary)] tabular-nums">
          {originalCount} → {totalDestinationBins} {totalDestinationBins === 1 ? t.bin : t.bins} · {totalItems} item{totalItems !== 1 ? 's' : ''} · {totalMoves} move{totalMoves !== 1 ? 's' : ''}
        </span>
      </div>

      {summary && (
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{summary}</p>
      )}

      <ul className="flex flex-col gap-3" aria-label="Source bins with outgoing moves">
        {sourceCards.map((card, idx) => (
          <SourceCardRow key={card.sourceBin.id} card={card} delay={idx * 40} />
        ))}
      </ul>

      {!isStreaming && result && (
        <div className="flex flex-col gap-3 pt-3 border-t border-[var(--border-subtle)]">
          <Button onClick={onAccept} disabled={isApplying} fullWidth>
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Applying…
              </>
            ) : (
              <>
                Accept — Move {totalItems} item{totalItems !== 1 ? 's' : ''}, create {totalDestinationBins}{' '}
                {totalDestinationBins === 1 ? t.bin : t.bins}
              </>
            )}
          </Button>
          <div className="flex gap-2 justify-center flex-wrap">
            {onPrint && (
              <Button variant="ghost" size="sm" onClick={onPrint} disabled={isApplying}>
                Print move list
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={isApplying}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Regenerate
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={isApplying}>
              Start over
            </Button>
          </div>
        </div>
      )}

      {typeof document !== 'undefined' &&
        createPortal(
          <div className="move-list-print-only" aria-hidden="true">
            <MoveListSheet
              sourceCards={sourceCards}
              areas={areas}
              qrStyle={DEFAULT_QR_STYLE}
              totalItems={totalItems}
              totalMoves={totalMoves}
              totalDestinationBins={totalDestinationBins}
              summary={summary}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

function SourceCardRow({ card, delay }: { card: SourceCard; delay: number }) {
  const Icon = card.sourceBin.icon ? resolveIcon(card.sourceBin.icon) : Package;
  const colorPreset = card.sourceBin.color ? resolveColor(card.sourceBin.color) : undefined;
  const chipBg = colorPreset?.bg ?? 'var(--bg-hover)';
  const itemTotal = card.outgoingClusters.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <li
      aria-label={`${card.sourceBin.name}: ${itemTotal} item${itemTotal !== 1 ? 's' : ''} moving`}
      className="ai-stagger-item rounded-[var(--radius-md)] border border-[var(--border-flat)] bg-[var(--bg-input)] p-3.5 space-y-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex items-center justify-center rounded-[var(--radius-sm)] h-6 w-6 shrink-0"
          style={{ backgroundColor: chipBg }}
        >
          <Icon className="h-3.5 w-3.5 text-[var(--text-primary)]" />
        </span>
        <span className="font-medium text-[14px] text-[var(--text-primary)] truncate">
          {card.sourceBin.name || '…'}
        </span>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-medium tabular-nums px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-[var(--bg-hover)] text-[var(--text-tertiary)]">
            {itemTotal}
          </span>
          <span className="text-[11px] text-[var(--text-tertiary)]">will be emptied</span>
        </span>
      </div>

      {card.renameShaped && (
        <div className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-[var(--accent)]/10 px-3 py-2">
          <Lightbulb className="h-3.5 w-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
          <p className="text-[12px] text-[var(--text-secondary)] leading-snug">
            All items stay together — you can relabel this container instead of moving items.
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {card.outgoingClusters.map((cluster) => (
          <ClusterRow key={cluster.destinationName} cluster={cluster} />
        ))}
      </ul>
    </li>
  );
}

function ClusterRow({ cluster }: { cluster: SourceCard['outgoingClusters'][number] }) {
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = cluster.items.length > COLLAPSED_ITEM_LIMIT;
  const visibleItems = expanded ? cluster.items : cluster.items.slice(0, COLLAPSED_ITEM_LIMIT);
  const hiddenCount = cluster.items.length - COLLAPSED_ITEM_LIMIT;

  return (
    <li className="flex items-start gap-2 text-[13px]">
      <span aria-hidden="true" className="text-[var(--text-tertiary)] shrink-0 mt-0.5">
        →
      </span>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-[var(--radius-xs)] bg-[var(--bg-hover)] px-1.5 py-0.5 text-[12px] font-medium text-[var(--text-primary)]">
            <Package className="h-3 w-3" aria-hidden="true" />
            {cluster.destinationName || '…'}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">new</span>
          {cluster.destinationTags.length > 0 && (
            <div className="flex items-center gap-1 ml-1">
              {cluster.destinationTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="text-[13px] text-[var(--text-secondary)] leading-snug">
          {renderItemList(visibleItems)}
          {hasOverflow && !expanded && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-[12px] font-medium text-[var(--accent)] hover:opacity-80 ml-1"
              >
                show {hiddenCount} more
              </button>
            </>
          )}
          {expanded && hasOverflow && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="text-[12px] font-medium text-[var(--accent)] hover:opacity-80 ml-1"
              >
                show less
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function renderItemList(items: MoveListItem[]): string {
  return items
    .map((item) => {
      const qty = item.quantity != null && item.quantity !== 1 ? `${item.quantity} ` : '';
      const name = `${qty}${item.name}`;
      return item.multiDestinationCount && item.multiDestinationCount > 1
        ? `${name} (×${item.multiDestinationCount} destinations)`
        : name;
    })
    .join(', ');
}
