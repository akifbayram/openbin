import { ChevronDown, FolderTree, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogPortal } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CreateAreaDialog } from './AreaDialogs';
import { buildAreaTree, flattenAreaTree, useAreaList } from './useAreas';

const dropdownRow = 'flex w-full items-center gap-2.5 px-3 py-1.5 text-sm transition-colors cursor-pointer text-left';

interface AreaPickerProps {
  locationId: string | undefined;
  value: string | null;
  onChange: (areaId: string | null) => void;
}

export function AreaPicker({ locationId, value, onChange }: AreaPickerProps) {
  const dialogPortal = useDialogPortal();
  const { areas } = useAreaList(locationId);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedArea = areas.find((a) => a.id === value);
  const flatAreas = useMemo(() => flattenAreaTree(buildAreaTree(areas)), [areas]);
  const trimmed = search.trim().toLowerCase();

  const filtered = useMemo(
    () => !trimmed ? flatAreas : flatAreas.filter((a) => a.name.toLowerCase().includes(trimmed)),
    [flatAreas, trimmed],
  );

  // "No area" + filtered areas + "Create" = total items for keyboard nav
  const itemCount = 1 + filtered.length + 1; // no-area + areas + create

  const rafRef = useRef(0);
  const reposition = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const vv = window.visualViewport;
      const vvTop = vv?.offsetTop ?? 0;
      const vvLeft = vv?.offsetLeft ?? 0;
      const t = rect.bottom + 4 + vvTop;
      const l = rect.left + vvLeft;
      const w = rect.width;
      setPos((prev) => prev && prev.top === t && prev.left === l && prev.width === w ? prev : { top: t, left: l, width: w });
    });
  }, []);

  // Close on outside click; reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    reposition();
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);
    document.addEventListener('mousedown', handleClick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('scroll', reposition);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open, reposition]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setSearch('');
      setHighlightIndex(-1);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  function select(areaId: string | null) {
    onChange(areaId);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % itemCount);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i <= 0 ? itemCount - 1 : i - 1));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      if (highlightIndex === 0) {
        select(null);
      } else if (highlightIndex <= filtered.length) {
        select(filtered[highlightIndex - 1].id);
      } else {
        setCreateOpen(true);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(
          'row-spread w-full h-11 rounded-[var(--radius-sm)] border border-[var(--border-flat)] bg-[var(--bg-input)] px-3.5 text-[15px] text-left transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
          !selectedArea && 'text-[var(--text-tertiary)]'
        )}
      >
        <span className="truncate">{selectedArea ? selectedArea.name : 'No area'}</span>
        <ChevronDown className={cn('h-4 w-4 text-[var(--text-tertiary)] shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] rounded-[var(--radius-md)] flat-popover overflow-hidden"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {flatAreas.length > 5 && (
            <div className="p-1.5 border-b border-[var(--border-subtle)]">
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setHighlightIndex(-1); }}
                onKeyDown={handleKeyDown}
                placeholder="Search areas..."
                className="h-8 text-sm border-0 bg-transparent focus-visible:ring-0 focus-visible:shadow-none"
              />
            </div>
          )}

          <div ref={listRef} className="max-h-48 overflow-y-auto py-1">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); select(null); }}
              className={cn(
                dropdownRow,
                highlightIndex === 0
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : value === null
                    ? 'text-[var(--accent)] font-medium'
                    : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]',
              )}
            >
              No area
            </button>
            {filtered.map((area, i) => {
              const idx = i + 1;
              const isSelected = value === area.id;
              return (
                <button
                  key={area.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); select(area.id); }}
                  className={cn(
                    dropdownRow,
                    highlightIndex === idx
                      ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                      : isSelected
                        ? 'text-[var(--accent)] font-medium'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
                  )}
                  style={{ paddingLeft: 12 + area.depth * 16 }}
                >
                  {area.depth > 0 && (
                    <FolderTree className="h-3 w-3 flex-shrink-0 text-[var(--text-quaternary)]" />
                  )}
                  <span>{area.name}</span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setCreateOpen(true); setOpen(false); }}
              className={cn(
                dropdownRow, 'py-2',
                highlightIndex === itemCount - 1
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
              )}
            >
              <Plus className="h-3.5 w-3.5 flex-shrink-0 text-[var(--accent)]" />
              <span>Create new area...</span>
            </button>
          </div>
        </div>,
        dialogPortal ?? document.body,
      )}

      <CreateAreaDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        locationId={locationId ?? null}
        areas={areas}
        onCreated={(area) => onChange(area.id)}
      />
    </div>
  );
}
