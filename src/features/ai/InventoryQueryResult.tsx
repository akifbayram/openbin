import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { QueryResult } from './useInventoryQuery';

interface InventoryQueryResultProps {
  queryResult: QueryResult;
  onBinClick: (binId: string) => void;
  onBack: () => void;
}

export function InventoryQueryResult({ queryResult, onBinClick, onBack }: InventoryQueryResultProps) {
  return (
    <div className="space-y-4">
      <p className="text-[14px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
        {queryResult.answer}
      </p>

      {queryResult.matches.length > 0 && (
        <div className="space-y-2">
          {queryResult.matches.map((match) => (
            <button
              key={match.bin_id}
              type="button"
              onClick={() => onBinClick(match.bin_id)}
              className="glass-card w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-[var(--bg-active)] transition-colors cursor-pointer rounded-[var(--radius-sm)]"
            >
              <Search className="h-4 w-4 shrink-0 text-[var(--accent)]" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[var(--text-primary)] truncate">{match.name}</p>
                {match.area_name && (
                  <p className="text-[12px] text-[var(--text-tertiary)]">{match.area_name}</p>
                )}
                {match.items.length > 0 && (
                  <p className="text-[12px] text-[var(--text-secondary)] truncate">{match.items.join(', ')}</p>
                )}
                {match.relevance && (
                  <p className="text-[11px] text-[var(--text-tertiary)] italic mt-0.5">{match.relevance}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
            </button>
          ))}
        </div>
      )}

      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="rounded-[var(--radius-full)]">
        <ChevronLeft className="h-4 w-4 mr-0.5" />
        Back
      </Button>
    </div>
  );
}
