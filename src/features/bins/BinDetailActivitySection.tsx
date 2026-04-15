import { AlertTriangle, Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Crossfade } from '@/components/ui/crossfade';
import { EmptyState } from '@/components/ui/empty-state';
import { ActivityTableSkeleton } from '@/features/activity/ActivityTableSkeleton';
import { ActivityTableView } from '@/features/activity/ActivityTableView';
import { sectionHeader, sectionHeaderRow } from '@/lib/utils';
import { useBinActivity } from './useBinActivity';

const PREVIEW_COUNT = 5;

interface BinDetailActivitySectionProps {
  binId: string;
}

export function BinDetailActivitySection({ binId }: BinDetailActivitySectionProps) {
  const [expanded, setExpanded] = useState(false);
  const { entries, isLoading, isLoadingMore, hasMore, error, loadMore } = useBinActivity(binId);

  const previewEntries = useMemo(
    () => (expanded ? entries : entries.slice(0, PREVIEW_COUNT)),
    [expanded, entries],
  );
  const hasHiddenEntries = entries.length > PREVIEW_COUNT || hasMore;

  return (
    <section>
      <header className={sectionHeaderRow}>
        <h3 className={sectionHeader}>Activity</h3>
        {hasHiddenEntries && !isLoading && !error && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
          >
            {expanded ? 'Show less' : 'View all'}
          </Button>
        )}
      </header>

      <Crossfade
        isLoading={isLoading && entries.length === 0}
        skeleton={<ActivityTableSkeleton count={3} />}
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
            entries={previewEntries}
            hasMore={expanded && hasMore}
            isLoadingMore={isLoadingMore}
            loadMore={loadMore}
            currentEntityId={binId}
          />
        )}
      </Crossfade>
    </section>
  );
}
