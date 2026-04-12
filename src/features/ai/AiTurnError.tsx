import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, flatCard } from '@/lib/utils';

interface AiTurnErrorProps {
  error: string;
  canRetry: boolean;
  onRetry: () => void;
}

export function AiTurnError({ error, canRetry, onRetry }: AiTurnErrorProps) {
  return (
    <div className={cn(flatCard, 'ai-turn-enter p-3 border-[var(--destructive)]/40')}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--destructive)]" />
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-[13px] text-[var(--destructive)] [overflow-wrap:anywhere]">{error}</p>
          {canRetry && (
            <Button type="button" size="sm" variant="ghost" onClick={onRetry}>
              <RotateCw className="h-3.5 w-3.5 mr-1" />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
