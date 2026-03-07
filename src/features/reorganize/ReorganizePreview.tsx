import { Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { PartialReorgResult } from './parsePartialReorg';
import type { ReorgResponse } from './useReorganize';

interface ReorganizePreviewProps {
  result: ReorgResponse | null;
  partialResult: PartialReorgResult;
  isStreaming: boolean;
  isApplying: boolean;
  originalCount: number;
  onAccept: () => void;
  onCancel: () => void;
}

export function ReorganizePreview({
  result,
  partialResult,
  isStreaming,
  isApplying,
  originalCount,
  onAccept,
  onCancel,
}: ReorganizePreviewProps) {
  const displayBins = result ? result.bins : partialResult.bins;
  const summary = result?.summary ?? partialResult.summary;

  if (displayBins.length === 0 && !isStreaming) return null;

  const totalItems = displayBins.reduce((sum, b) => sum + b.items.length, 0);

  return (
    <div className="space-y-4">
      <div className="row-spread">
        <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal">Proposal</Label>
        <span className="text-[12px] text-[var(--text-tertiary)] tabular-nums">
          {originalCount} → {displayBins.length} bin{displayBins.length !== 1 ? 's' : ''} · {totalItems} item{totalItems !== 1 ? 's' : ''}
        </span>
      </div>

      {summary && (
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{summary}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {displayBins.map((bin) => (
          <div key={bin.name} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
              <span className="font-medium text-[14px] text-[var(--text-primary)] truncate">{bin.name || '\u2026'}</span>
              <span className="ml-auto text-[12px] text-[var(--text-tertiary)] shrink-0">
                {bin.items.length}
              </span>
            </div>
            {bin.items.length > 0 && (
              <ul className="space-y-0.5 pl-6">
                {bin.items.map((item) => (
                  <li key={item} className="list-disc text-[13px] text-[var(--text-secondary)]">
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {(bin.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 pl-6">
                {(bin.tags ?? []).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[11px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {!isStreaming && result && (
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" onClick={onCancel} disabled={isApplying}>
            Discard
          </Button>
          <Button onClick={onAccept} disabled={isApplying}>
            {isApplying ? 'Applying\u2026' : 'Accept & Apply'}
          </Button>
        </div>
      )}
    </div>
  );
}
