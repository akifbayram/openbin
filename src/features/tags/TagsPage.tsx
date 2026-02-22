import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Tags as TagsIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
      backgroundColor: theme === 'dark' ? preset.bgDark : preset.bg,
      color: theme === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.75)',
    };
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-6 pb-2 max-w-2xl mx-auto">
      <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
        Tags
      </h1>

      {(totalCount > 0 || search) && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tags..."
            className="pl-10 rounded-[var(--radius-full)] h-10 text-[15px]"
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full rounded-[var(--radius-full)]" />
          <div className="flex flex-col gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-4 w-12 flex-1" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          ))}
          </div>
        </div>
      ) : tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
          <TagsIcon className="h-16 w-16 opacity-40" />
          <div className="text-center space-y-1.5">
            <p className="text-[17px] font-semibold text-[var(--text-secondary)]">
              {search ? 'No tags match your search' : 'No tags yet'}
            </p>
            {!search && (
              <p className="text-[13px]">Tags added to {t.bins} will appear here</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {tags.map((entry) => (
            <div
              key={entry.tag}
              role="button"
              tabIndex={0}
              onClick={() => handleTagClick(entry.tag)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTagClick(entry.tag);
              }}
              className="glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3 cursor-pointer transition-all duration-200 active:scale-[0.98] hover:bg-[var(--bg-hover)]"
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
            </div>
          ))}
          <LoadMoreSentinel hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
        </div>
      )}
    </div>
  );
}
