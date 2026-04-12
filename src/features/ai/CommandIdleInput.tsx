import { Camera, ChevronDown, ImagePlus, Plus, Sparkles } from 'lucide-react';
import { type Dispatch, type SetStateAction, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import { useTerminology } from '@/lib/terminology';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';
import type { useTranscription } from '@/lib/useTranscription';
import { cn } from '@/lib/utils';
import { TranscriptionMicButton } from './TranscriptionMicButton';

interface CommandIdleInputProps {
  text: string;
  setText: (v: string) => void;
  isLoading: boolean;
  examplesOpen: boolean;
  setExamplesOpen: Dispatch<SetStateAction<boolean>>;
  error: string | null;
  onParse: () => void;
  onPhotoClick: () => void;
  onCameraClick?: () => void;
  isScoped?: boolean;
  transcription?: ReturnType<typeof useTranscription>;
}

export function CommandIdleInput({
  text,
  setText,
  isLoading,
  examplesOpen,
  setExamplesOpen,
  error,
  onParse,
  onPhotoClick,
  onCameraClick,
  isScoped,
  transcription,
}: CommandIdleInputProps) {
  const t = useTerminology();
  const isTranscribing = transcription && transcription.state !== 'idle';
  const attachPopover = usePopover();
  const attachRef = useRef<HTMLDivElement>(null);
  useClickOutside(attachRef, attachPopover.close);

  const examples = useMemo(() => isScoped ? [
    { label: 'Auto-tag', example: 'Auto-tag these based on their contents' },
    { label: 'Find common', example: 'What do these have in common?' },
    { label: 'Organize', example: `Move all of these to the Garage ${t.area}` },
    { label: 'Rename', example: 'Suggest better names for these' },
    { label: 'Search', example: 'Which of these contain electronics?' },
  ] : [
    { label: 'Add/remove items', example: 'Add screwdriver to the tools bin' },
    { label: 'Organize', example: 'Move batteries from kitchen to garage' },
    { label: `Manage ${t.bins}`, example: `Create a ${t.bin} called Holiday Decorations in the attic` },
    { label: 'Quick actions', example: `Duplicate the tools ${t.bin}` },
    { label: `Manage ${t.areas}`, example: `Rename the garage ${t.area} to workshop` },
    { label: 'Find things', example: 'Where is the glass cleaner?' },
    { label: 'Search trash', example: "What's in my trash?" },
  ], [isScoped, t]);

  return (
    <div className="space-y-3">
      <div className={cn(
        'rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border-flat)] transition-all duration-200',
        'focus-within:ring-2 focus-within:ring-[var(--accent)]',
      )}>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What would you like to do?"
          rows={3}
          className="min-h-[60px] border-0 bg-transparent focus-visible:ring-0 focus-visible:shadow-none"
          disabled={isLoading || !!isTranscribing}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onParse();
            }
          }}
        />
        <div data-tour="photo-buttons" className="flex items-center gap-0.5 px-2 pb-2">
          {!isTranscribing && onCameraClick ? (
            <div ref={attachRef} className="relative">
              <Tooltip content="Add photos">
                <button
                  type="button"
                  onClick={attachPopover.toggle}
                  className="p-1.5 rounded-[var(--radius-lg)] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--bg-active)] transition-colors"
                  aria-label="Add photos"
                  aria-expanded={attachPopover.isOpen}
                >
                  <Plus className={cn('h-5 w-5 transition-transform duration-200', attachPopover.isOpen && 'rotate-45')} />
                </button>
              </Tooltip>
              {attachPopover.visible && (
                <div className={cn(
                  attachPopover.animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter',
                  'absolute left-0 bottom-full mb-1 w-44 rounded-[var(--radius-md)] flat-popover overflow-hidden z-20',
                )}>
                  <button
                    type="button"
                    onClick={() => { onPhotoClick(); attachPopover.close(); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <ImagePlus className="h-4 w-4 text-[var(--text-tertiary)]" />
                    Upload photos
                  </button>
                  <button
                    type="button"
                    onClick={() => { onCameraClick(); attachPopover.close(); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <Camera className="h-4 w-4 text-[var(--text-tertiary)]" />
                    Take photo
                  </button>
                </div>
              )}
            </div>
          ) : !isTranscribing ? (
            <Tooltip content={`Upload photos to auto-create ${t.bins} with AI`}>
              <button
                type="button"
                onClick={onPhotoClick}
                className="p-1.5 rounded-[var(--radius-lg)] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--bg-active)] transition-colors"
                aria-label="Upload photos"
              >
                <Plus className="h-5 w-5" />
              </button>
            </Tooltip>
          ) : null}
          <div className="flex-1" />
          {transcription && (
            <TranscriptionMicButton transcription={transcription} />
          )}
        </div>
      </div>

      {/* Collapsible examples */}
      <div className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
        <button
          type="button"
          onClick={() => setExamplesOpen((v) => !v)}
          className="flex items-center gap-1 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !examplesOpen && '-rotate-90')} />
          Examples
        </button>
        {examplesOpen && (
          <div className="grid gap-1 mt-1.5">
            {examples.map(({ label, example }) => (
              <p key={label}>
                <span className="text-[var(--text-secondary)]">{label}</span>
                {' — '}
                <button
                  type="button"
                  onClick={() => setText(example)}
                  className="text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:underline transition-colors cursor-pointer"
                >
                  &quot;{example}&quot;
                </button>
              </p>
            ))}
            <p><span className="text-[var(--text-secondary)]">Upload photos</span> — Snap a photo of a {t.bin} and AI will create it for you</p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-[13px] text-[var(--destructive)]">{error}</p>
      )}

      <Button
        type="button"
        onClick={onParse}
        disabled={!text.trim() || isLoading}
        className="w-full bg-[var(--ai-accent)] hover:bg-[var(--ai-accent-hover)]"
      >
        <Sparkles className="h-4 w-4 mr-1.5" />
        {isLoading ? 'Processing...' : 'Send'}
      </Button>
    </div>
  );
}
