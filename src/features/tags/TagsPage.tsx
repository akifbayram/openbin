import { useState, useCallback } from 'react';
import { Tags as TagsIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { Crossfade } from '@/components/ui/crossfade';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { useDebounce } from '@/lib/useDebounce';
import { usePaginatedTagList } from './useTags';
import { useTagColorsContext } from './TagColorsContext';
import { setTagColor } from './useTagColors';
import { TagTableView, type TagSortColumn } from './TagTableView';
import type { SortDirection } from '@/components/ui/sort-header';
import { resolveColor } from '@/lib/colorPalette';
import { useTheme } from '@/lib/theme';
import { PageHeader } from '@/components/ui/page-header';

export function TagsPage() {
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<TagSortColumn>('alpha');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const debouncedSearch = useDebounce(search, 300);
  const { activeLocationId } = useAuth();
  const t = useTerminology();
  const { tags, totalCount, isLoading, isLoadingMore, hasMore, loadMore } = usePaginatedTagList(debouncedSearch, sortColumn, sortDirection);
  const { tagColors } = useTagColorsContext();
  const { theme } = useTheme();

  const handleSortChange = useCallback((column: TagSortColumn, direction: SortDirection) => {
    setSortColumn(column);
    setSortDirection(direction);
  }, []);

  function handleColorChange(tag: string, color: string) {
    if (!activeLocationId) return;
    setTagColor(activeLocationId, tag, color);
  }

  function getTagBadgeStyle(tag: string) {
    const colorKey = tagColors.get(tag);
    if (!colorKey) return undefined;
    const preset = resolveColor(colorKey);
    if (!preset) return undefined;
    return {
      backgroundColor: preset.bgCss,
      color: theme === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.75)',
    };
  }

  return (
    <div className="page-content">
      <PageHeader title="Tags" />

      {(totalCount > 0 || search) && (
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tags..."
        />
      )}

      <Crossfade
        isLoading={isLoading && tags.length === 0}
        skeleton={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full rounded-[var(--radius-full)]" />
            <div className="glass-card rounded-[var(--radius-md)] overflow-hidden">
              <div className="h-9 bg-[var(--bg-hover)] border-b border-[var(--border-subtle)]" />
              <SkeletonList count={6}>
                {() => (
                  <div className="px-3 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-3">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-4 w-12 flex-1" />
                    <Skeleton className="h-6 w-6 rounded-full" />
                  </div>
                )}
              </SkeletonList>
            </div>
          </div>
        }
      >
        {tags.length === 0 ? (
          <EmptyState
            icon={TagsIcon}
            title={search ? 'No tags match your search' : 'No tags yet'}
            subtitle={search ? undefined : `Tags added to ${t.bins} will appear here`}
          />
        ) : (
          <TagTableView
            tags={tags}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            searchQuery={debouncedSearch}
            tagColors={tagColors}
            getTagBadgeStyle={getTagBadgeStyle}
            onColorChange={handleColorChange}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            loadMore={loadMore}
          />
        )}
      </Crossfade>
    </div>
  );
}
