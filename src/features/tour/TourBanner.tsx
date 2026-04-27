import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TourBannerProps {
  appName: string;
  onStart: () => void;
  onDismiss: () => void;
}

export function TourBanner({ appName, onStart, onDismiss }: TourBannerProps) {
  return (
    <div className="fixed z-40 bottom-[calc(12px+var(--bottom-bar-height)+var(--safe-bottom))] lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-[360px] bg-[var(--ai-accent)] rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3 fade-in-fast print-hide">
      <Sparkles className="h-5 w-5 text-white shrink-0" />
      <p className="flex-1 text-[14px] font-medium text-white">
        See what {appName} can do
      </p>
      <Button
        size="sm"
        onClick={onStart}
        className="h-8 px-3.5 text-[13px] shrink-0 bg-white text-[var(--ai-accent)] hover:bg-white/90 active:bg-white/80"
      >
        Show me
      </Button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss tour prompt"
        className="flex items-center justify-center h-8 w-8 min-h-[44px] min-w-[44px] -m-1 shrink-0 text-white/80 hover:text-white hover:bg-white/15 transition-colors rounded-[var(--radius-sm)]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
