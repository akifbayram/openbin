import { Check, Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { LabelThreshold } from '@/components/ui/ai-progress-bar';
import { AiProgressBar } from '@/components/ui/ai-progress-bar';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import type { useDictation } from '@/lib/useDictation';
import { cn, formatElapsed } from '@/lib/utils';

const TRANSCRIBE_LABELS: LabelThreshold[] = [
  [0, 'Sending audio...'],
  [30, 'Transcribing...'],
  [70, 'Almost done...'],
];

const STRUCTURE_LABELS: LabelThreshold[] = [
  [0, 'Parsing items...'],
  [30, 'Extracting items...'],
  [70, 'Almost done...'],
];

interface DictationButtonProps {
  dictation: ReturnType<typeof useDictation>;
}

export function DictationButton({ dictation }: DictationButtonProps) {
  const {
    state,
    transcript,
    duration,
    structuredItems,
    start,
    stop,
    cancel,
    confirm,
    editTranscript,
    submitEditedTranscript,
  } = dictation;

  const [editing, setEditing] = useState(false);
  const [checked, setChecked] = useState<Map<number, boolean>>(new Map());
  const editRef = useRef<HTMLTextAreaElement>(null);

  // Reset local state when dictation returns to idle
  useEffect(() => {
    if (state === 'idle' || state === 'recording') {
      setEditing(false);
      setChecked(new Map());
    }
  }, [state]);

  function toggleChecked(index: number) {
    setChecked((prev) => {
      const next = new Map(prev);
      next.set(index, !(prev.get(index) ?? true));
      return next;
    });
  }

  function handleEditClick() {
    setEditing(true);
    editTranscript(transcript ?? '');
    setTimeout(() => editRef.current?.focus(), 0);
  }

  function handleConfirm() {
    if (!structuredItems) return;
    const selected = structuredItems.filter((_, i) => checked.get(i) !== false);
    confirm(selected);
    setChecked(new Map());
  }

  const elapsed = formatElapsed(duration);

  if (state === 'idle') {
    return (
      <Tooltip content="Dictate items">
        <button
          type="button"
          onClick={start}
          className="shrink-0 flex items-center justify-center size-11 rounded-[var(--radius-lg)] text-[var(--text-tertiary)] hover:bg-[var(--bg-active)] transition-colors"
          aria-label="Dictate items"
        >
          <Mic className="h-4 w-4" />
        </button>
      </Tooltip>
    );
  }

  if (state === 'recording') {
    return (
      <output className="shrink-0 flex items-center gap-1.5" aria-label={`Recording: ${elapsed}`}>
        <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">{elapsed}</span>
        <Tooltip content="Stop recording">
          <button
            type="button"
            onClick={stop}
            className="relative flex items-center justify-center size-11 rounded-full bg-[var(--destructive)] text-[var(--text-on-accent)] hover:bg-[var(--destructive-hover)] active:bg-[var(--destructive-active)] transition-colors"
            aria-label="Stop recording"
          >
            <span className="absolute inset-[-3px] rounded-full bg-[var(--destructive)]/25 animate-pulse motion-reduce:animate-none" />
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        </Tooltip>
      </output>
    );
  }

  if (state === 'transcribing') {
    return (
      <output className="w-full" aria-live="polite" aria-label="Transcribing audio">
        <AiProgressBar active compact labels={TRANSCRIBE_LABELS} />
      </output>
    );
  }

  if (state === 'previewing-transcript') {
    return (
      <output className="w-full space-y-2" aria-live="polite">
        <div className="rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-500">Heard:</span>
            <div className="flex-1" />
            {!editing && (
              <button
                type="button"
                onClick={handleEditClick}
                className="text-[11px] text-[var(--text-quaternary)] underline hover:text-[var(--text-tertiary)]"
              >
                edit
              </button>
            )}
          </div>
          {editing ? (
            <div className="space-y-2">
              <textarea
                ref={editRef}
                value={transcript ?? ''}
                onChange={(e) => editTranscript(e.target.value)}
                className="w-full min-h-[60px] bg-[var(--bg-input)] rounded-[var(--radius-xs)] px-2.5 py-2 text-sm text-[var(--text-primary)] outline-none resize-none border border-[var(--border-flat)]"
                rows={2}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancel}
                  className="text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    submitEditedTranscript();
                  }}
                  disabled={!transcript?.trim()}
                >
                  Use this
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)] italic">
              &ldquo;{transcript}&rdquo;
            </p>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-0.5 rounded-full bg-[var(--border-subtle)] overflow-hidden">
              <div className="h-full bg-[var(--accent)] rounded-full animate-[dictation-progress_1.5s_linear]" />
            </div>
            <span className="text-[11px] text-[var(--text-quaternary)]">Parsing items...</span>
          </div>
        )}
      </output>
    );
  }

  if (state === 'structuring') {
    return (
      <output className="w-full" aria-live="polite" aria-label="Parsing items">
        <AiProgressBar active compact labels={STRUCTURE_LABELS} />
      </output>
    );
  }

  if (state === 'preview' && structuredItems) {
    const selectedCount = structuredItems.filter((_, i) => checked.get(i) !== false).length;
    return (
      <output className="w-full space-y-2" aria-live="polite">
        <div className="text-xs text-[var(--text-quaternary)]">
          {structuredItems.length} item{structuredItems.length !== 1 ? 's' : ''} parsed from dictation
        </div>
        <div className="flex flex-wrap gap-1.5">
          {structuredItems.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: items identified by stable index for toggle state
            <button key={i}
              type="button"
              onClick={() => toggleChecked(i)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full min-h-[44px] px-3 py-2 text-[13px] transition-all',
                checked.get(i) !== false
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] line-through',
              )}
            >
              {checked.get(i) !== false && <Check className="h-3 w-3" />}
              {item.quantity ? `${item.name} (\u00d7${item.quantity})` : item.name}
            </button>
          ))}
        </div>
        <div className="row pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={cancel} className="gap-0.5">
            Cancel
          </Button>
          <div className="flex-1" />
          <Button type="button" size="sm" onClick={handleConfirm} disabled={selectedCount === 0}>
            Add {selectedCount}
          </Button>
        </div>
      </output>
    );
  }

  return null;
}
