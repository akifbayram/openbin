import { X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from './badge';

interface DismissibleBadgeProps {
  children: React.ReactNode;
  onDismiss: () => void;
  ariaLabel: string;
  style?: CSSProperties;
  dot?: string;
}

export function DismissibleBadge({ children, onDismiss, ariaLabel, style, dot }: DismissibleBadgeProps) {
  const [exiting, setExiting] = useState(false);

  function handleDismiss() {
    setExiting(true);
    setTimeout(onDismiss, 200);
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        `${dot ? 'gap-1.5' : 'gap-1'} pr-1.5 py-0.5 shrink-0 text-[11px]`,
        exiting ? 'animate-shrink-out' : 'animate-fade-in-up',
      )}
      style={style}
    >
      {dot && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />}
      {children}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={ariaLabel}
        className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-active)]"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </Badge>
  );
}
