import { Camera, ChevronDown, ImagePlus, Sparkles } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';

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
}: CommandIdleInputProps) {
  const t = useTerminology();

  const defaultExamples = [
    { label: 'Add/remove items', example: 'Add screwdriver to the tools bin' },
    { label: 'Organize', example: 'Move batteries from kitchen to garage' },
    { label: `Manage ${t.bins}`, example: `Create a ${t.bin} called Holiday Decorations in the attic` },
    { label: 'Quick actions', example: `Duplicate the tools ${t.bin}` },
    { label: `Manage ${t.areas}`, example: `Rename the garage ${t.area} to workshop` },
    { label: 'Find things', example: 'Where is the glass cleaner?' },
    { label: 'Search trash', example: "What's in my trash?" },
  ];

  const scopedExamples = [
    { label: 'Auto-tag', example: 'Auto-tag these based on their contents' },
    { label: 'Find common', example: 'What do these have in common?' },
    { label: 'Organize', example: `Move all of these to the Garage ${t.area}` },
    { label: 'Rename', example: 'Suggest better names for these' },
    { label: 'Search', example: 'Which of these contain electronics?' },
  ];

  const examples = isScoped ? scopedExamples : defaultExamples;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What would you like to do?"
          rows={3}
          className={cn("min-h-[80px] bg-[var(--bg-elevated)]", onCameraClick ? "pr-[4.5rem]" : "pr-12")}
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onParse();
            }
          }}
        />
        <div data-tour="photo-buttons" className="absolute right-2.5 bottom-2.5 flex items-center gap-0.5">
          {onCameraClick && (
            <button
              type="button"
              onClick={onCameraClick}
              className="p-1.5 rounded-[var(--radius-lg)] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--bg-active)] transition-colors"
              title="Take photos with camera"
              aria-label="Take photos with camera"
            >
              <Camera className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onPhotoClick}
            className="p-1.5 rounded-[var(--radius-lg)] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--bg-active)] transition-colors"
            title={`Upload photos to auto-create ${t.bins} with AI`}
            aria-label="Upload photos"
          >
            <ImagePlus className="h-5 w-5" />
          </button>
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
