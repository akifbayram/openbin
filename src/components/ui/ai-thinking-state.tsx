import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AiThinkingStateProps {
  isLoading: boolean;
  label?: string;
  placeholderCount?: number;
  columns?: 1 | 2;
  children: ReactNode;
}

function SkeletonCard() {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] p-3.5 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded animate-shimmer shrink-0" />
        <div className="h-4 w-24 rounded animate-shimmer" />
        <div className="ml-auto h-3 w-6 rounded animate-shimmer shrink-0" />
      </div>
      <div className="space-y-1.5 pl-6">
        <div className="h-3 w-3/4 rounded animate-shimmer" />
        <div className="h-3 w-1/2 rounded animate-shimmer" />
      </div>
    </div>
  );
}

export function AiThinkingState({
  isLoading,
  label,
  placeholderCount = 4,
  columns = 1,
  children,
}: AiThinkingStateProps) {
  const hasChildren = !isLoading;

  return (
    <div className="relative">
      {/* Skeleton layer */}
      <div
        className={cn(
          'transition-opacity duration-300',
          hasChildren ? 'opacity-0 pointer-events-none absolute inset-0' : 'opacity-100',
        )}
        aria-hidden={hasChildren}
      >
        <div
          className={cn(
            'grid gap-3',
            columns === 2 && 'sm:grid-cols-2',
          )}
        >
          {Array.from({ length: placeholderCount }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder skeletons never reorder
            <SkeletonCard key={i} />
          ))}
        </div>

        {label && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="ai-thinking-pulse flex items-center gap-2 rounded-full bg-[var(--bg-primary)]/90 px-4 py-2 border border-[var(--border-subtle)]">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-[13px] font-medium text-[var(--text-secondary)]">
                {label}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Real content layer */}
      <div
        className={cn(
          'transition-opacity duration-300',
          hasChildren ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none',
        )}
      >
        {children}
      </div>
    </div>
  );
}
