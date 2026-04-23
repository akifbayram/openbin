import { HelpCircle } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { useUserPreferences } from '@/lib/userPreferences';
import { cn, focusRing, iconButton } from '@/lib/utils';
import { useTourContext } from './TourProvider';
import { getTour, type TourId } from './tourRegistry';

interface TourLauncherProps {
  tourId: TourId;
  variant?: 'icon' | 'menu';
  className?: string;
}

export function TourLauncher({ tourId, variant = 'icon', className }: TourLauncherProps) {
  const tourCtx = useTourContext();
  const { preferences } = useUserPreferences();
  const tour = getTour(tourId);
  if (!tour) return null;
  const seen = (preferences.tours_seen ?? []).includes(tourId);

  function start() {
    tourCtx?.tour.start(tourId);
  }

  if (variant === 'icon') {
    return (
      <Tooltip content={`Tour: ${tour.title}`} side="bottom">
        <button
          type="button"
          onClick={start}
          aria-label={`Tour: ${tour.title}`}
          className={cn(
            iconButton,
            focusRing,
            'h-9 w-9 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
            seen && 'opacity-60',
            className,
          )}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </Tooltip>
    );
  }

  const Icon = tour.icon;
  return (
    <button
      type="button"
      onClick={start}
      className={cn(
        'w-full flex items-center gap-3 py-3 px-2 rounded-[var(--radius-sm)] text-left hover:bg-[var(--bg-hover)] transition-colors',
        className,
      )}
    >
      <Icon className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-[var(--text-primary)]">{tour.title}</span>
          {seen && <span className="text-[11px] text-[var(--text-tertiary)]">· seen</span>}
        </div>
        <p className="text-[12px] text-[var(--text-tertiary)] truncate">{tour.summary}</p>
      </div>
      <span className="text-[12px] text-[var(--text-tertiary)]">
        {tour.steps.length} step{tour.steps.length === 1 ? '' : 's'}
      </span>
    </button>
  );
}
