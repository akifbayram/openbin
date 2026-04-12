import { Camera, Image as ImageIcon, Send, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import type { useTranscription } from '@/lib/useTranscription';
import { cn, iconButton } from '@/lib/utils';
import { TranscriptionMicButton } from './TranscriptionMicButton';

interface ConversationComposerProps {
  onSend: (text: string) => void;
  onCancel: () => void;
  onPhotoClick: () => void;
  onCameraClick: () => void;
  isStreaming: boolean;
  transcription?: ReturnType<typeof useTranscription>;
  disabled?: boolean;
}

export function ConversationComposer({
  onSend,
  onCancel,
  onPhotoClick,
  onCameraClick,
  isStreaming,
  transcription,
  disabled,
}: ConversationComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function send() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    textareaRef.current?.focus();
  }

  const isTranscribing = transcription && transcription.state !== 'idle';

  return (
    <div className="border-t border-[var(--border-flat)] bg-[var(--bg-elevated)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask anything…"
          rows={1}
          aria-label="Ask AI"
          enterKeyHint="send"
          autoComplete="off"
          disabled={!!isTranscribing || disabled}
          className="flex-1 min-h-[40px] max-h-[160px]"
        />
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onPhotoClick}
            className={cn(
              iconButton,
              'rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-active)]',
            )}
            aria-label="Upload photo"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onCameraClick}
            className={cn(
              iconButton,
              'rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-active)]',
            )}
            aria-label="Take photo"
          >
            <Camera className="h-5 w-5" />
          </button>
          {transcription && <TranscriptionMicButton transcription={transcription} />}
          {isStreaming ? (
            <button
              type="button"
              onClick={onCancel}
              className={cn(iconButton, 'rounded-[var(--radius-sm)] bg-[var(--destructive)] text-white')}
              aria-label="Stop"
            >
              <Square className="h-4 w-4" fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={send}
              disabled={!text.trim() || disabled}
              className={cn(
                iconButton,
                'rounded-[var(--radius-sm)] bg-[var(--accent)] text-white disabled:opacity-40',
              )}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
