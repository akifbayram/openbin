import { ChevronLeft, ChevronRight, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StreamingText } from './StreamingText';
import type { QueryResult } from './useInventoryQuery';

interface InventoryQueryResultProps {
  queryResult: QueryResult | null;
  streamingText?: string;
  isStreaming?: boolean;
  onBinClick: (binId: string, isTrashed?: boolean) => void;
  onBack: () => void;
}

export function InventoryQueryResult({ queryResult, streamingText, isStreaming, onBinClick, onBack }: InventoryQueryResultProps) {
  const showStreaming = isStreaming && !queryResult;
  const answer = queryResult?.answer ?? streamingText ?? '';
  const matches = queryResult?.matches ?? [];

  return (
    <div className="space-y-4">
      <div className="ai-content-enter">
        <StreamingText
          text={answer}
          isStreaming={!!showStreaming}
          className="text-[14px] leading-relaxed"
        />
      </div>

      {matches.length > 0 && (
        <div className="space-y-2">
          {matches.map((match, i) => (
            <button
              key={match.bin_id}
              className="ai-stagger-item glass-card w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-gray-500/16 dark:hover:bg-gray-500/28 transition-colors cursor-pointer rounded-[var(--radius-sm)]"
              style={{ animationDelay: `${Math.min(i * 60, 500)}ms` }}
              type="button"
              onClick={() => onBinClick(match.bin_id, match.is_trashed)}
            >
              {match.is_trashed
                ? <Trash2 className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                : <Search className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium truncate">{match.name}</p>
                {match.area_name && (
                  <p className="text-[12px] text-gray-500 dark:text-gray-400">{match.area_name}</p>
                )}
                {match.items.length > 0 && (
                  <p className="text-[12px] text-gray-600 dark:text-gray-300 truncate">{match.items.join(', ')}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
            </button>
          ))}
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
