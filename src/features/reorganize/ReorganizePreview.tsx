import { AlertTriangle, ChevronDown, Loader2, Package, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import type { PartialReorgResult } from './parsePartialReorg';
import type { ReorgResponse } from './useReorganize';

const COLLAPSED_ITEM_LIMIT = 5;

interface ReorganizePreviewProps {
  result: ReorgResponse | null;
  partialResult: PartialReorgResult;
  isStreaming: boolean;
  isApplying: boolean;
  originalCount: number;
  originalItemCount: number;
  onAccept: () => void;
  onCancel: () => void;
  onRegenerate: () => void;
}

export function ReorganizePreview({
  result,
  partialResult,
  isStreaming,
  isApplying,
  originalCount,
  originalItemCount,
  onAccept,
  onCancel,
  onRegenerate,
}: ReorganizePreviewProps) {
  const t = useTerminology();
  const displayBins = result ? result.bins : partialResult.bins;
  const summary = result?.summary ?? partialResult.summary;

  if (displayBins.length === 0 && !isStreaming) return null;

  const totalItems = displayBins.reduce((sum, b) => sum + b.items.length, 0);
  const itemMismatch = !isStreaming && result && totalItems !== originalItemCount;

  return (
    <div className="space-y-4">
      <div className="row-spread">
        <Label className="text-[15px] font-semibold text-[var(--text-primary)]">
          Proposal
        </Label>
        <span className="text-[12px] text-[var(--text-tertiary)] tabular-nums">
          {originalCount} → {displayBins.length} {displayBins.length === 1 ? t.bin : t.bins} · {totalItems} item{totalItems !== 1 ? 's' : ''}
        </span>
      </div>

      {summary && (
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{summary}</p>
      )}

      {itemMismatch && (
        <div role="alert" className="flex items-start gap-2.5 rounded-[var(--radius-sm)] bg-[var(--destructive-soft)] px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-[var(--destructive)] shrink-0 mt-0.5" />
          <p className="text-[13px] text-[var(--text-secondary)]">
            Item count mismatch: expected {originalItemCount}, got {totalItems}.
            {totalItems < originalItemCount
              ? ` ${originalItemCount - totalItems} item${originalItemCount - totalItems !== 1 ? 's' : ''} may have been dropped.`
              : ` ${totalItems - originalItemCount} extra item${totalItems - originalItemCount !== 1 ? 's' : ''} added.`}
            {' '}Try regenerating. This attempt did not count against your AI credits.
          </p>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2" aria-label="Proposed bins">
        {displayBins.map((bin, idx) => (
          <BinCard
            key={bin.name}
            name={bin.name}
            items={bin.items}
            tags={bin.tags ?? []}
            delay={idx * 40}
          />
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
              'Accept & Apply'
            )}
          </Button>
          <div className="flex gap-2 justify-center">
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
    </div>
  );
}

function BinCard({
  name,
  items,
  tags,
  delay,
}: {
  name: string;
  items: string[];
  tags: string[];
  delay: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = items.length > COLLAPSED_ITEM_LIMIT;
  const visibleItems = expanded ? items : items.slice(0, COLLAPSED_ITEM_LIMIT);
  const hiddenCount = items.length - COLLAPSED_ITEM_LIMIT;

  return (
    <li
      aria-label={`${name}: ${items.length} item${items.length !== 1 ? 's' : ''}`}
      className="ai-stagger-item rounded-[var(--radius-md)] border border-[var(--border-flat)] bg-[var(--bg-input)] p-3.5 space-y-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
        <span className="font-medium text-[14px] text-[var(--text-primary)] truncate">
          {name || '\u2026'}
        </span>
        <span
          className="ml-auto text-[11px] font-medium tabular-nums shrink-0 px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-[var(--bg-hover)] text-[var(--text-tertiary)]"
        >
          {items.length}
        </span>
      </div>
      {visibleItems.length > 0 && (
        <ul className="space-y-0.5 pl-6">
          {visibleItems.map((item) => (
            <li key={item} className="list-disc text-[13px] text-[var(--text-secondary)]">
              {item}
            </li>
          ))}
        </ul>
      )}
      {hasOverflow && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 pl-6 text-[12px] font-medium text-[var(--accent)] hover:opacity-80 transition-opacity min-h-[44px]"
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', expanded && 'rotate-180')} />
          {expanded ? 'Show less' : `Show ${hiddenCount} more`}
        </button>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-6">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[11px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </li>
  );
}
