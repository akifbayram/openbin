import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { PartialReorgResult } from './parsePartialReorg';

interface ReorgResponse {
  bins: Array<{ name: string; items: string[] }>;
  summary: string;
}

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
    <div className="stack-3">
      {summary && (
        <p className="text-sm text-[var(--text-secondary)]">{summary}</p>
      )}

      <div className="text-xs text-[var(--text-tertiary)]">
        {originalCount} bin{originalCount !== 1 ? 's' : ''} →{' '}
        {displayBins.length} bin{displayBins.length !== 1 ? 's' : ''} ·{' '}
        {totalItems} item{totalItems !== 1 ? 's' : ''}
        {isStreaming && ' · streaming\u2026'}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {displayBins.map((bin, i) => (
          <Card key={i} className="p-4 stack-2">
            <div className="flex-row-2 items-center">
              <Package className="icon-4 text-[var(--text-tertiary)]" />
              <span className="font-medium text-sm">{bin.name || '\u2026'}</span>
              <span className="ml-auto text-xs text-[var(--text-tertiary)]">
                {bin.items.length} item{bin.items.length !== 1 ? 's' : ''}
              </span>
            </div>
            {bin.items.length > 0 && (
              <ul className="stack-1 pl-6 text-xs text-[var(--text-secondary)]">
                {bin.items.map((item, j) => (
                  <li key={j} className="list-disc">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      {!isStreaming && result && (
        <div className="flex-row-2 justify-end pt-2">
          <Button variant="outline" onClick={onCancel} disabled={isApplying}>
            Cancel
          </Button>
          <Button onClick={onAccept} disabled={isApplying}>
            {isApplying ? 'Applying\u2026' : 'Accept & Apply'}
          </Button>
        </div>
      )}
    </div>
  );
}
