import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tags as TagsIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ListItem } from '@/components/ui/list-item';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-list';
import { Crossfade } from '@/components/ui/crossfade';
import { LoadMoreSentinel } from '@/components/ui/load-more-sentinel';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { useDebounce } from '@/lib/useDebounce';
import { usePaginatedTagList } from './useTags';
import { useTagColorsContext } from './TagColorsContext';
import { setTagColor } from './useTagColors';
import { TagColorPicker } from './TagColorPicker';
import { resolveColor } from '@/lib/colorPalette';
import { useTheme } from '@/lib/theme';
import { PageHeader } from '@/components/ui/page-header';

export function TagsPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const navigate = useNavigate();
  const { activeLocationId } = useAuth();
  const t = useTerminology();
  const { tags, totalCount, isLoading, isLoadingMore, hasMore, loadMore } = usePaginatedTagList(debouncedSearch);
  const { tagColors } = useTagColorsContext();
  const { theme } = useTheme();

  function handleTagClick(tag: string) {
    navigate(`/bins?tags=${encodeURIComponent(tag)}`);
  }

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
        isLoading={isLoading}
        skeleton={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full rounded-[var(--radius-full)]" />
            <SkeletonList>
              {() => (
                <div className="glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-4 w-12 flex-1" />
                  <Skeleton className="h-6 w-6 rounded-full" />
                </div>
              )}
            </SkeletonList>
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
          <div className="flex flex-col gap-1">
            {tags.map((entry, index) => (
              <ListItem
                key={entry.tag}
                interactive
                role="button"
                tabIndex={0}
                className="animate-stagger-in [@media(hover:hover)]:hover:shadow-[var(--shadow-elevated)] [@media(hover:hover)]:hover:-translate-y-0.5"
                style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                onClick={() => handleTagClick(entry.tag)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTagClick(entry.tag);
                }}
              >
                <Badge
                  variant="secondary"
                  className="text-[13px]"
                  style={getTagBadgeStyle(entry.tag)}
                >
                  {entry.tag}
                </Badge>
                <span className="flex-1 text-[13px] text-[var(--text-tertiary)]">
                  {entry.count} {entry.count !== 1 ? t.bins : t.bin}
                </span>
                <TagColorPicker
                  currentColor={tagColors.get(entry.tag) || ''}
                  onColorChange={(color) => handleColorChange(entry.tag, color)}
                />
              </ListItem>
            ))}
            <LoadMoreSentinel hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
          </div>
        )}
      </Crossfade>
    </div>
  );
}
