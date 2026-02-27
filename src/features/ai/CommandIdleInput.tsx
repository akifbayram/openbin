import type { Dispatch, SetStateAction } from 'react';
import { Sparkles, Loader2, ImagePlus, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/lib/terminology';

interface CommandIdleInputProps {
  text: string;
  setText: (v: string) => void;
  effectiveState: string;
  examplesOpen: boolean;
  setExamplesOpen: Dispatch<SetStateAction<boolean>>;
  error: string | null;
  onParse: () => void;
  onPhotoClick: () => void;
}

export function CommandIdleInput({
  text,
  setText,
  effectiveState,
  examplesOpen,
  setExamplesOpen,
  error,
  onParse,
  onPhotoClick,
}: CommandIdleInputProps) {
  const t = useTerminology();

  return (
    <div className="space-y-3">
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What would you like to do?"
          rows={3}
          className="min-h-[80px] bg-[var(--bg-elevated)] pr-12"
          disabled={effectiveState === 'parsing' || effectiveState === 'executing'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onParse();
            }
          }}
        />
        <button
          type="button"
          onClick={onPhotoClick}
          className="absolute right-2.5 bottom-2.5 p-1.5 rounded-full text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--bg-active)] transition-colors"
          title={`Upload photos to auto-create ${t.bins} with AI`}
          aria-label="Upload photos"
        >
          <ImagePlus className="h-5 w-5" />
        </button>
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
            <p><span className="text-[var(--text-secondary)]">Add/remove items</span> — &quot;Add screwdriver to the tools bin&quot; or &quot;Remove batteries from kitchen box&quot;</p>
            <p><span className="text-[var(--text-secondary)]">Organize</span> — &quot;Move batteries from kitchen to garage&quot; or &quot;Tag tools bin as hardware&quot;</p>
            <p><span className="text-[var(--text-secondary)]">Manage {t.bins}</span> — &quot;Create a {t.bin} called Holiday Decorations in the attic&quot; or &quot;Delete the empty box {t.bin}&quot;</p>
            <p><span className="text-[var(--text-secondary)]">Find things</span> — &quot;Where is the glass cleaner?&quot; or &quot;Which {t.bins} have batteries?&quot;</p>
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
        disabled={!text.trim() || effectiveState === 'parsing' || effectiveState === 'executing'}
        className="w-full rounded-[var(--radius-full)] bg-[var(--ai-accent)] hover:bg-[var(--ai-accent-hover)]"
      >
        {effectiveState === 'parsing' || effectiveState === 'executing' ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 mr-1.5" />
        )}
        {effectiveState === 'parsing' ? 'Understanding...' : effectiveState === 'executing' ? 'Executing...' : 'Send'}
      </Button>
    </div>
  );
}
