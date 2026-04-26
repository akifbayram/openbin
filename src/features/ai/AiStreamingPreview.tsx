import { AlertCircle, AlertTriangle, ChevronDown, Clock, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type AiErrorVariant = 'rate-limit' | 'provider-down' | 'invalid-config' | 'generic';

/**
 * Match patterns per variant, ordered by precedence. Strings come from
 * `mapAiError()` (see ai/aiErrors.ts) — keep in sync if those messages change.
 */
const ERROR_PATTERNS: Array<[AiErrorVariant, string[]]> = [
  ['rate-limit', ['rate', '429', 'too many']],
  ['provider-down', ['502', 'provider returned', 'not responding', 'unavailable']],
  ['invalid-config', ['invalid api key', 'check settings', 'verify your settings']],
];

export function classifyAiError(message: string): AiErrorVariant {
  const lower = message.toLowerCase();
  for (const [variant, patterns] of ERROR_PATTERNS) {
    if (patterns.some((p) => lower.includes(p))) return variant;
  }
  return 'generic';
}

const VARIANT_TITLES: Record<AiErrorVariant, string> = {
  'rate-limit': 'Rate limit reached',
  'provider-down': 'Provider unavailable',
  'invalid-config': 'AI configuration issue',
  generic: 'Analysis failed',
};

const VARIANT_ICONS: Record<AiErrorVariant, typeof AlertCircle> = {
  'rate-limit': Clock,
  'provider-down': AlertTriangle,
  'invalid-config': AlertTriangle,
  generic: AlertCircle,
};

interface AiStreamingPreviewProps {
  previewUrls: string[];
  streamedName: string;
  streamedItems: string[];
  initialStatusLabel: string;
}

/** Shared streaming analysis UI — photo with scan overlay, streamed name/items, status indicator. */
export function AiStreamingPreview({ previewUrls, streamedName, streamedItems, initialStatusLabel }: AiStreamingPreviewProps) {
  const hasStreamedData = streamedItems.length > 0 || streamedName.length > 0;
  const shimmerClass = cn(
    'rounded-[var(--radius-lg)] ai-photo-shrink transition-all duration-500 ease-in-out',
    hasStreamedData ? 'max-h-20 opacity-80' : 'max-h-64',
  );
  const imgClass = 'w-full h-full object-cover rounded-[var(--radius-lg)] bg-black/5 dark:bg-white/5 transition-[filter] duration-700 ease-out';

  return (
    <div className="space-y-3" aria-live="polite" aria-atomic="false">
      {previewUrls.length === 1 ? (
        <div className={shimmerClass}>
          <img src={previewUrls[0]} alt="Preview 1" className={imgClass} />
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto">
          {previewUrls.map((url, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: preview URLs have no stable identity
            <div key={i} className={cn('shrink-0 flex-1 min-w-0', shimmerClass)}>
              <img src={url} alt={`Preview ${i + 1}`} className={imgClass} />
            </div>
          ))}
        </div>
      )}

      {streamedName && (
        <p className="text-[15px] font-medium text-[var(--text-primary)]">
          {streamedName}
        </p>
      )}

      {streamedItems.length > 0 && (
        <ul className="space-y-1">
          {streamedItems.map((item, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: streamed items have no stable identity
              key={i}
            >
              <div className="text-[13px] text-[var(--text-secondary)] pl-3 border-l-2 border-[var(--accent)]">
                {item}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="row text-[13px] text-[var(--text-tertiary)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
        <span>{hasStreamedData ? 'Finding more items...' : initialStatusLabel}</span>
      </div>
    </div>
  );
}

interface AiAnalyzeErrorProps {
  error: string;
  detail?: string;
  onRetry: () => void;
  /**
   * When supplied, renders a "Check AI Settings" button alongside Retry —
   * but only for variants where reconfiguration is plausible (i.e. not
   * rate-limit or provider-down, which are external transient issues).
   */
  onConfigureAi?: () => void;
}

/**
 * Inline error banner with retry + optional reconfigure button. Variant is
 * classified from the error message: rate-limit shows amber + Clock,
 * provider-down/invalid-config show destructive + AlertTriangle, generic
 * falls back to AlertCircle.
 */
export function AiAnalyzeError({ error, detail, onRetry, onConfigureAi }: AiAnalyzeErrorProps) {
  const [showDetail, setShowDetail] = useState(false);
  const variant = classifyAiError(error);
  const isRateLimit = variant === 'rate-limit';
  const isProviderDown = variant === 'provider-down';
  const Icon = VARIANT_ICONS[variant];
  const showConfigButton = !!onConfigureAi && !isRateLimit && !isProviderDown;

  return (
    <div
      role="alert"
      className={cn(
        'rounded-[var(--radius-md)] border p-3.5',
        isRateLimit
          ? 'bg-amber-500/5 border-amber-500/20'
          : 'bg-[var(--destructive)]/5 border-[var(--destructive)]/20',
      )}
    >
      <div className="flex gap-2.5">
        <Icon
          className={cn(
            'h-4 w-4 shrink-0 mt-0.5',
            isRateLimit ? 'text-amber-500' : 'text-[var(--destructive)]',
          )}
        />
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-[13px] font-semibold mb-0.5',
              isRateLimit ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--destructive)]',
            )}
          >
            {VARIANT_TITLES[variant]}
          </p>
          <p className="text-[12px] text-[var(--text-tertiary)] mb-2.5">{error}</p>
          {detail && detail !== error && (
            <>
              <button
                type="button"
                onClick={() => setShowDetail(!showDetail)}
                className="mb-1.5 flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <ChevronDown className={cn('h-3 w-3 transition-transform', !showDetail && '-rotate-90')} />
                Details
              </button>
              {showDetail && (
                <p className="mb-2 text-[11px] text-[var(--text-tertiary)] font-mono break-all">{detail}</p>
              )}
            </>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={onRetry}>
              Retry
            </Button>
            {showConfigButton && (
              <Button type="button" size="sm" variant="outline" onClick={onConfigureAi}>
                Check AI Settings
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
