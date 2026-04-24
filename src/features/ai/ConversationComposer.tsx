import { Camera, Image as ImageIcon, Plus, Send, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';
import type { useTranscription } from '@/lib/useTranscription';
import { cn, focusRing, iconButton } from '@/lib/utils';
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

interface AttachmentMenuProps {
  onPhotoClick: () => void;
  onCameraClick: () => void;
  disabled?: boolean;
}

function AttachmentMenu({ onPhotoClick, onCameraClick, disabled }: AttachmentMenuProps) {
  const { visible, animating, isOpen, close, toggle } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, close);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={cn(
          iconButton,
          focusRing,
          'rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-colors',
          isOpen && 'bg-[var(--bg-active)] text-[var(--text-primary)]',
        )}
        aria-label="Add attachment"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        data-tour="photo-to-bin"
      >
        <Plus className="h-5 w-5" />
      </button>
      {visible && (
        <div
          role="menu"
          className={cn(
            animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter',
            'absolute left-0 bottom-full mb-2 w-48 rounded-[var(--radius-md)] flat-popover overflow-hidden z-20',
          )}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onCameraClick();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Camera className="h-4 w-4 text-[var(--text-tertiary)]" />
            Take photo
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onPhotoClick();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <ImageIcon className="h-4 w-4 text-[var(--text-tertiary)]" />
            Upload from gallery
          </button>
        </div>
      )}
    </div>
  );
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
  const canSend = text.trim().length > 0 && !disabled;

  return (
    <div
      data-tour="ask-composer"
      className="border-t border-[var(--border-flat)] bg-[var(--bg-elevated)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <div
        className={cn(
          'flex items-end gap-1 rounded-[var(--radius-lg)] border border-[var(--border-flat)] bg-[var(--bg-input)] p-1.5',
          'focus-within:ring-2 focus-within:ring-[var(--accent)] transition-shadow',
        )}
      >
        <AttachmentMenu
          onPhotoClick={onPhotoClick}
          onCameraClick={onCameraClick}
          disabled={disabled || !!isTranscribing}
        />

        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
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
          className="flex-1 min-h-[36px] max-h-[160px] bg-transparent border-0 rounded-none px-2 py-1.5 focus-visible:ring-0"
        />

        {transcription && <TranscriptionMicButton transcription={transcription} />}

        {isStreaming ? (
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              iconButton,
              focusRing,
              'rounded-[var(--radius-sm)] bg-[var(--destructive)] text-[var(--text-on-accent)] hover:bg-[var(--destructive-hover)] transition-colors',
            )}
            aria-label="Stop"
          >
            <Square className="h-4 w-4" fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className={cn(
              iconButton,
              focusRing,
              'rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors',
            )}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
