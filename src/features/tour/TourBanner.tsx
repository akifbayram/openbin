import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TourBannerProps {
  appName: string;
  onStart: () => void;
  onDismiss: () => void;
}

export function TourBanner({ appName, onStart, onDismiss }: TourBannerProps) {
  return (
    <div className="fixed z-40 bottom-[calc(12px+var(--bottom-bar-height)+var(--safe-bottom))] lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-[360px] flat-heavy rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3 fade-in-fast print-hide">
      <Sparkles className="h-5 w-5 text-[var(--accent)] shrink-0" />
      <p className="flex-1 text-[14px] text-[var(--text-primary)]">
        See what {appName} can do
      </p>
      <Button
        size="sm"
        onClick={onStart}
        className="h-8 px-3.5 text-[13px] shrink-0"
      >
        Show me
      </Button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss tour prompt"
        className="flex items-center justify-center h-8 w-8 min-h-[44px] min-w-[44px] -m-1 shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors rounded-[var(--radius-sm)]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
