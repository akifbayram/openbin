import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Tags as TagsIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useBinList } from '@/features/bins/useBins';
import { useTagColorsContext } from './TagColorsContext';
import { setTagColor } from './useTagColors';
import { TagColorPicker } from './TagColorPicker';
import { getColorPreset } from '@/lib/colorPalette';
import { useTheme } from '@/lib/theme';

interface TagInfo {
  name: string;
  count: number;
}

export function TagsPage() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { activeLocationId } = useAuth();
  const { bins } = useBinList();
  const { tagColors } = useTagColorsContext();
  const { theme } = useTheme();

  const tags = useMemo(() => {
    const tagMap = new Map<string, number>();
    for (const bin of bins) {
      if (Array.isArray(bin.tags)) {
        for (const tag of bin.tags) {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        }
      }
    }

    const result: TagInfo[] = [];
    for (const [name, count] of tagMap) {
      result.push({ name, count });
    }
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [bins]);

  const filteredTags = useMemo(() => {
    if (!search.trim()) return tags;
    const q = search.toLowerCase().trim();
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, search]);

  function handleTagClick(tag: string) {
    navigate('/', { state: { search: tag } });
  }

  function handleColorChange(tag: string, color: string) {
    if (!activeLocationId) return;
    setTagColor(activeLocationId, tag, color);
  }

  function getTagBadgeStyle(tag: string) {
    const colorKey = tagColors.get(tag);
    if (!colorKey) return undefined;
    const preset = getColorPreset(colorKey);
    if (!preset) return undefined;
    return {
      backgroundColor: theme === 'dark' ? preset.bgDark : preset.bg,
      color: theme === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.75)',
    };
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 lg:pt-6 pb-2">
      <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
        Tags
      </h1>

      {tags.length > 0 && (
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

      {filteredTags.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-[var(--text-tertiary)]">
          <TagsIcon className="h-16 w-16 opacity-40" />
          <div className="text-center space-y-1.5">
            <p className="text-[17px] font-semibold text-[var(--text-secondary)]">
              {search ? 'No tags match your search' : 'No tags yet'}
            </p>
            {!search && (
              <p className="text-[13px]">Tags added to bins will appear here</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {filteredTags.map((tag) => (
            <div
              key={tag.name}
              role="button"
              tabIndex={0}
              onClick={() => handleTagClick(tag.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTagClick(tag.name);
              }}
              className="glass-card rounded-[var(--radius-lg)] px-4 py-3 flex items-center gap-3 cursor-pointer transition-all duration-200 active:scale-[0.98] hover:bg-[var(--bg-hover)]"
            >
              <Badge
                variant="secondary"
                className="text-[13px]"
                style={getTagBadgeStyle(tag.name)}
              >
                {tag.name}
              </Badge>
              <span className="flex-1 text-[13px] text-[var(--text-tertiary)]">
                {tag.count} bin{tag.count !== 1 ? 's' : ''}
              </span>
              <TagColorPicker
                currentColor={tagColors.get(tag.name) || ''}
                onColorChange={(color) => handleColorChange(tag.name, color)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
