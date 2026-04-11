import { Mic, Square } from 'lucide-react';
import type { LabelThreshold } from '@/components/ui/ai-progress-bar';
import { AiProgressBar } from '@/components/ui/ai-progress-bar';
import { Tooltip } from '@/components/ui/tooltip';
import type { useTranscription } from '@/lib/useTranscription';
import { cn } from '@/lib/utils';

const TRANSCRIBE_LABELS: LabelThreshold[] = [
  [0, 'Sending audio...'],
  [30, 'Transcribing...'],
  [70, 'Almost done...'],
];

interface TranscriptionMicButtonProps {
  transcription: ReturnType<typeof useTranscription>;
  className?: string;
}

export function TranscriptionMicButton({ transcription, className }: TranscriptionMicButtonProps) {
  const { state, duration, start, stop, cancel } = transcription;

  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const elapsed = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  if (state === 'recording') {
    return (
      <output
        className={cn('flex items-center gap-2 w-full', className)}
        aria-live="polite"
        aria-label="Recording audio"
      >
        <div className="relative flex items-center justify-center size-4">
          <span className="absolute size-4 rounded-full bg-[var(--destructive)] opacity-30 animate-ping" />
          <span className="size-2 rounded-full bg-[var(--destructive)]" />
        </div>
        <span className="text-[13px] font-medium text-[var(--destructive)]">Recording</span>
        <span className="text-[13px] text-[var(--text-tertiary)] tabular-nums">{elapsed}</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={stop}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] text-[12px] font-medium text-[var(--destructive)] bg-[var(--destructive)]/10 border border-[var(--destructive)]/25 hover:bg-[var(--destructive)]/15 transition-colors"
          aria-label="Stop recording"
        >
          <Square className="h-3 w-3 fill-current" />
          Stop
        </button>
        <button
          type="button"
          onClick={cancel}
          className="shrink-0 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Cancel recording"
        >
          Cancel
        </button>
      </output>
    );
  }

  if (state === 'transcribing') {
    return (
      <output
        className={cn('w-full', className)}
        aria-live="polite"
        aria-label="Transcribing audio"
      >
        <AiProgressBar active compact labels={TRANSCRIBE_LABELS} />
      </output>
    );
  }

  // idle
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
