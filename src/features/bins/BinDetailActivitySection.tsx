import { AlertTriangle, Clock } from 'lucide-react';
import { useState } from 'react';
import { Crossfade } from '@/components/ui/crossfade';
import { EmptyState } from '@/components/ui/empty-state';
import { ActivityTableSkeleton } from '@/features/activity/ActivityTableSkeleton';
import { ActivityTableView } from '@/features/activity/ActivityTableView';
import { sectionHeader, sectionHeaderRow } from '@/lib/utils';
import { useBinActivity } from './useBinActivity';

const PREVIEW_COUNT = 5;
const EXPANDED_PAGE_SIZE = 20;

interface BinDetailActivitySectionProps {
  binId: string;
}

export function BinDetailActivitySection({ binId }: BinDetailActivitySectionProps) {
  const [expanded, setExpanded] = useState(false);
  const { entries, isLoading, isLoadingMore, hasMore, error, loadMore } = useBinActivity(
    binId,
    expanded ? EXPANDED_PAGE_SIZE : PREVIEW_COUNT,
  );

  const visibleEntries = expanded ? entries : entries.slice(0, PREVIEW_COUNT);
  const hasHiddenEntries = entries.length > PREVIEW_COUNT || hasMore;
  const showToggle = hasHiddenEntries && !isLoading && !error;

  return (
    <section>
      <header className={sectionHeaderRow}>
        <h3 className={sectionHeader}>Activity</h3>
      </header>

      <Crossfade
        isLoading={isLoading && entries.length === 0}
        skeleton={<ActivityTableSkeleton count={PREVIEW_COUNT} />}
      >
        {error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Failed to load activity"
            subtitle={error}
            compact
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No activity yet"
            subtitle="Changes to this bin will appear here"
            compact
          />
        ) : (
          <ActivityTableView
            entries={visibleEntries}
            hasMore={expanded && hasMore}
            isLoadingMore={isLoadingMore}
            loadMore={loadMore}
            currentEntityId={binId}
          />
        )}
      </Crossfade>

      {showToggle && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className="text-[13px] text-[var(--accent)] underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none rounded-sm"
          >
            {expanded ? 'Show less' : 'Show all events'}
          </button>
        </div>
      )}
    </section>
  );
}
