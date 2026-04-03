import { ChevronLeft, ChevronRight, Search, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { StreamingText } from './StreamingText';
import type { QueryResult } from './useInventoryQuery';

interface InventoryQueryResultProps {
  queryResult: QueryResult | null;
  streamingText?: string;
  isStreaming?: boolean;
  onBinClick: (binId: string, isTrashed?: boolean) => void;
  onBack: () => void;
  onFollowUp?: (text: string) => void;
}

export function InventoryQueryResult({ queryResult, streamingText, isStreaming, onBinClick, onBack, onFollowUp }: InventoryQueryResultProps) {
  const showStreaming = isStreaming && !queryResult;
  const answer = queryResult?.answer ?? streamingText ?? '';
  const matches = queryResult?.matches ?? [];
  const [followUp, setFollowUp] = useState('');

  return (
    <div className="space-y-4">
      <StreamingText
        text={answer}
        isStreaming={!!showStreaming}
        className="text-[14px] text-[var(--text-primary)] leading-relaxed"
      />

      {matches.length > 0 && (
        <div className="space-y-2">
          {matches.map((match, i) => (
            <button
              key={match.bin_id}
              className="ai-stagger-item flat-card w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-[var(--bg-active)] transition-colors cursor-pointer rounded-[var(--radius-sm)]"
              style={{ animationDelay: `${Math.min(i * 60, 500)}ms` }}
              type="button"
              onClick={() => onBinClick(match.bin_id, match.is_trashed)}
            >
              {match.is_trashed
                ? <Trash2 className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                : <Search className="h-4 w-4 shrink-0 text-[var(--accent)]" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[var(--text-primary)] truncate">{match.name}</p>
                {match.area_name && (
                  <p className="text-[12px] text-[var(--text-tertiary)]">{match.area_name}</p>
                )}
                {match.items.length > 0 && (
                  <p className="text-[12px] text-[var(--text-secondary)] truncate">{match.items.join(', ')}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
            </button>
          ))}
        </div>
      )}

      {!isStreaming && matches.length === 0 && queryResult && (
        <p className="text-[13px] text-[var(--text-tertiary)] text-center py-2">
          No matching bins found. Try different terms or check trash.
        </p>
      )}

      {!isStreaming && onFollowUp && (
        <div className="relative">
          <Textarea
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && followUp.trim()) {
                e.preventDefault();
                onFollowUp(followUp.trim());
                setFollowUp('');
              }
            }}
            placeholder="Ask a follow-up..."
            rows={1}
            className="min-h-[44px] pr-12 bg-[var(--bg-elevated)]"
          />
          <button
            type="button"
            onClick={() => { if (followUp.trim()) { onFollowUp(followUp.trim()); setFollowUp(''); } }}
            disabled={!followUp.trim()}
            aria-label="Send follow-up"
            className={cn(
              'absolute right-2.5 bottom-2.5 p-1.5 rounded-[var(--radius-lg)] transition-colors',
              followUp.trim()
                ? 'text-[var(--ai-accent)] hover:bg-[var(--bg-active)]'
                : 'text-[var(--text-tertiary)] opacity-40',
            )}
          >
            <Sparkles className="h-5 w-5" />
          </button>
        </div>
      )}

      {!isStreaming && (
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          Back
        </Button>
      )}
    </div>
  );
}
