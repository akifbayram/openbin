import { cn, flatCard } from '@/lib/utils';
import { QueryAnswerBody } from './QueryAnswerBody';
import type { QueryResult } from './useInventoryQuery';

interface AiTurnQueryResultProps {
  queryResult: QueryResult;
  onBinClick: (binId: string, isTrashed?: boolean) => void;
}

export function AiTurnQueryResult(props: AiTurnQueryResultProps) {
  return (
    <div className={cn(flatCard, 'ai-turn-enter p-3')}>
      <QueryAnswerBody {...props} />
    </div>
  );
}
