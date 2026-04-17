import { BinItemGroup } from './BinItemGroup';
import type { QueryMatch } from './useInventoryQuery';

interface ItemQueryResultsProps {
  matches: QueryMatch[];
  onBinClick: (binId: string, isTrashed?: boolean) => void;
}

export function ItemQueryResults({ matches, onBinClick }: ItemQueryResultsProps) {
  if (matches.length === 0) return null;
  return (
    <div className="space-y-2">
      {matches.map((match) => (
        <BinItemGroup key={match.bin_id} match={match} onBinClick={onBinClick} />
      ))}
    </div>
  );
}
