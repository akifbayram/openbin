import { ChevronLeft, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { useTranscription } from '@/lib/useTranscription';
import { cn } from '@/lib/utils';
import { QueryAnswerBody } from './QueryAnswerBody';
import { TranscriptionMicButton } from './TranscriptionMicButton';
import type { QueryResult } from './useInventoryQuery';

interface InventoryQueryResultProps {
  queryResult: QueryResult | null;
  streamingText?: string;
  isStreaming?: boolean;
  onBinClick: (binId: string, isTrashed?: boolean) => void;
  onBack: () => void;
  onFollowUp?: (text: string) => void;
  transcription?: ReturnType<typeof useTranscription>;
}

export function InventoryQueryResult({
  queryResult,
  streamingText,
  isStreaming,
  onBinClick,
  onBack,
  onFollowUp,
  transcription,
}: InventoryQueryResultProps) {
  const [followUp, setFollowUp] = useState('');
  const isTranscribing = transcription && transcription.state !== 'idle';

  return (
    <div className="space-y-4">
      <QueryAnswerBody
        queryResult={queryResult}
        streamingText={streamingText}
        isStreaming={!!isStreaming}
        onBinClick={onBinClick}
      />

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
            disabled={!!isTranscribing}
            className={cn('min-h-[44px] bg-[var(--bg-elevated)]', transcription ? 'pr-[4.5rem]' : 'pr-12')}
          />
          <div className="absolute right-2.5 bottom-2.5 flex items-center gap-0.5">
            {transcription && <TranscriptionMicButton transcription={transcription} />}
            {!isTranscribing && (
              <button
                type="button"
                onClick={() => {
                  if (followUp.trim()) {
                    onFollowUp(followUp.trim());
                    setFollowUp('');
                  }
                }}
                disabled={!followUp.trim()}
                aria-label="Send follow-up"
                className={cn(
                  'p-1.5 rounded-[var(--radius-lg)] transition-colors',
                  followUp.trim()
                    ? 'text-[var(--ai-accent)] hover:bg-[var(--bg-active)]'
                    : 'text-[var(--text-tertiary)] opacity-40',
                )}
              >
                <Sparkles className="h-5 w-5" />
              </button>
            )}
          </div>
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
