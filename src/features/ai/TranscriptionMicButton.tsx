import { Loader2, Mic, Square } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import type { useTranscription } from '@/lib/useTranscription';
import { cn, formatElapsed } from '@/lib/utils';

interface TranscriptionMicButtonProps {
  transcription: ReturnType<typeof useTranscription>;
  className?: string;
}

export function TranscriptionMicButton({ transcription, className }: TranscriptionMicButtonProps) {
  const { state, duration, start, stop } = transcription;
  const elapsed = formatElapsed(duration);

  if (state === 'recording') {
    return (
      <output className={cn('flex items-center gap-1.5', className)} aria-label={`Recording: ${elapsed}`}>
        <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">{elapsed}</span>
        <Tooltip content="Stop recording">
          <button
            type="button"
            onClick={stop}
            className="relative flex items-center justify-center size-8 rounded-full bg-[var(--destructive)] text-[var(--text-on-accent)] hover:bg-[var(--destructive-hover)] active:bg-[var(--destructive-active)] transition-colors"
            aria-label="Stop recording"
          >
            <span className="absolute inset-[-3px] rounded-full bg-[var(--destructive)]/25 animate-pulse motion-reduce:animate-none" />
            <Square className="h-3 w-3 fill-current" />
          </button>
        </Tooltip>
      </output>
    );
  }

  if (state === 'transcribing') {
    return (
      <output
        className={cn('flex items-center justify-center p-1.5 text-[var(--accent)]', className)}
        aria-label="Transcribing audio"
      >
        <Loader2 className="h-5 w-5 animate-spin" />
      </output>
    );
  }

  return (
    <Tooltip content="Voice input">
      <button
        type="button"
        onClick={start}
        className={cn(
          'p-1.5 rounded-[var(--radius-lg)] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--bg-active)] transition-colors',
          className,
        )}
        aria-label="Voice input"
      >
        <Mic className="h-5 w-5" />
      </button>
    </Tooltip>
  );
}
