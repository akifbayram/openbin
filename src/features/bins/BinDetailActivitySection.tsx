import { AlertTriangle, Clock } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Crossfade } from '@/components/ui/crossfade';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { ActivityTableView } from '@/features/activity/ActivityTableView';
import { sectionHeader } from '@/lib/utils';
import { useBinActivity } from './useBinActivity';

const PREVIEW_COUNT = 5;

interface BinDetailActivitySectionProps {
  binId: string;
}

export function BinDetailActivitySection({ binId }: BinDetailActivitySectionProps) {
  const [expanded, setExpanded] = useState(false);
  const { entries, isLoading, isLoadingMore, hasMore, error, loadMore } = useBinActivity(binId);

  const visible = expanded ? entries : entries.slice(0, PREVIEW_COUNT);
  const canExpand = entries.length > PREVIEW_COUNT || hasMore;

  return (
    <section>
      <header className="flex items-baseline justify-between mb-4">
        <h3 className={sectionHeader}>Activity</h3>
        {canExpand && !isLoading && !error && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? 'Show less' : 'View all'}
          </Button>
        )}
      </header>

      <Crossfade
        isLoading={isLoading && entries.length === 0}
        skeleton={
          <div className="flat-card rounded-[var(--radius-lg)] overflow-hidden">
            <SkeletonList count={3}>
              {() => (
                <div className="px-3 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-3">
                  <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                  <Skeleton className="h-4 flex-[2]" />
                  <Skeleton className="h-4 w-20 shrink-0" />
                </div>
              )}
            </SkeletonList>
          </div>
        }
      >
        {error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Failed to load activity"
            subtitle={error}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No activity yet"
            subtitle="Changes to this bin will appear here"
          />
        ) : (
          <ActivityTableView
            entries={visible}
            hasMore={expanded && hasMore}
            isLoadingMore={isLoadingMore}
            loadMore={loadMore}
            searchQuery=""
            currentEntityId={binId}
          />
        )}
      </Crossfade>
    </section>
  );
}
