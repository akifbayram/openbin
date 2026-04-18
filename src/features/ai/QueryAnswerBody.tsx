import { ItemQueryResults } from './ItemQueryResults';
import { QueryIntroText } from './QueryIntroText';
import type { QueryResult } from './useInventoryQuery';

interface QueryAnswerBodyProps {
  queryResult: QueryResult;
  onBinClick: (binId: string, isTrashed?: boolean) => void;
}

export function QueryAnswerBody({ queryResult, onBinClick }: QueryAnswerBodyProps) {
  const { answer, matches } = queryResult;
  return (
    <div className="space-y-3">
      <QueryIntroText text={answer} />
      <ItemQueryResults matches={matches} onBinClick={onBinClick} />
      {matches.length === 0 && !answer.trim() && (
        <p className="text-[13px] text-[var(--text-tertiary)] text-center py-2">
          No matching bins found. Try different terms or check trash.
        </p>
      )}
    </div>
  );
}
