import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@chakra-ui/react';

interface AiStreamingPreviewProps {
  previewUrls: string[];
  streamedName: string;
  streamedItems: string[];
  initialStatusLabel: string;
}

/** Shared streaming analysis UI — photo with scan overlay, streamed name/items, status indicator. */
export function AiStreamingPreview({ previewUrls, streamedName, streamedItems, initialStatusLabel }: AiStreamingPreviewProps) {
  const hasStreamedData = streamedItems.length > 0 || streamedName.length > 0;
  const shimmerClass = `rounded-[var(--radius-lg)] ai-photo-shimmer ai-photo-shrink transition-all duration-500 ease-in-out ${
    hasStreamedData ? 'max-h-20 opacity-80' : 'max-h-64'
  }`;
  const imgClass = 'w-full h-full object-cover rounded-[var(--radius-lg)] bg-black/5 dark:bg-white/5';

  return (
    <div className="space-y-3">
      {previewUrls.length === 1 ? (
        <div className={shimmerClass}>
          <img src={previewUrls[0]} alt="Upload 1" className={imgClass} />
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto">
          {previewUrls.map((url, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: preview URLs have no stable identity
            <div key={i} className={`shrink-0 flex-1 min-w-0 ${shimmerClass}`}>
              <img src={url} alt={`Upload ${i + 1}`} className={imgClass} />
            </div>
          ))}
        </div>
      )}

      {streamedName && (
        <p className="text-[15px] font-medium text-[var(--text-primary)] ai-item-reveal">
          {streamedName}
        </p>
      )}

      {streamedItems.length > 0 && (
        <ul className="space-y-1">
          {streamedItems.map((item, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: streamed items have no stable identity
              key={i}
              className="text-[13px] text-[var(--text-secondary)] pl-3 border-l-2 border-[var(--accent)] ai-item-reveal"
            >
              {item}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 text-[13px] text-[var(--text-tertiary)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
        <span>{hasStreamedData ? 'Finding more items...' : initialStatusLabel}</span>
      </div>
    </div>
  );
}

/** Inline error banner with retry button for AI analysis failures. */
export function AiAnalyzeError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-red-500/10 px-3 py-2.5">
      <AlertCircle className="h-4 w-4 text-[var(--destructive)] shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-[13px] text-[var(--destructive)]">{error}</p>
        <Button variant="ghost" size="sm" onClick={onRetry} className="mt-1 h-7 px-2 text-[12px]">
          Retry
        </Button>
      </div>
    </div>
  );
}
