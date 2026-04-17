import { ChevronRight, Search, Trash2 } from 'lucide-react';
import type { QueryResult } from './useInventoryQuery';

interface QueryAnswerBodyProps {
  queryResult: QueryResult;
  onBinClick: (binId: string, isTrashed?: boolean) => void;
}

export function QueryAnswerBody({ queryResult, onBinClick }: QueryAnswerBodyProps) {
  const { answer, matches } = queryResult;

  return (
    <div className="space-y-3">
      <p className="text-[14px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
        {answer}
      </p>

      {matches.length > 0 && (
        <div className="space-y-2">
          {matches.map((match, i) => (
            <button
              key={match.bin_id}
              type="button"
              className="ai-stagger-item flat-card w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-[var(--bg-active)] transition-colors cursor-pointer rounded-[var(--radius-sm)]"
              style={{ animationDelay: `${Math.min(i * 60, 500)}ms` }}
              onClick={() => onBinClick(match.bin_id, match.is_trashed)}
            >
              {match.is_trashed ? (
                <Trash2 className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
              ) : (
                <Search className="h-4 w-4 shrink-0 text-[var(--accent)]" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[var(--text-primary)] truncate">{match.name}</p>
                {match.area_name && (
                  <p className="text-[12px] text-[var(--text-tertiary)]">{match.area_name}</p>
                )}
                {match.items.length > 0 && (
                  <p className="text-[12px] text-[var(--text-secondary)] truncate">
                    {match.items.map((it) => it.name).join(', ')}
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
            </button>
          ))}
        </div>
      )}

      {matches.length === 0 && (
        <p className="text-[13px] text-[var(--text-tertiary)] text-center py-2">
          No matching bins found. Try different terms or check trash.
        </p>
      )}
    </div>
  );
}
