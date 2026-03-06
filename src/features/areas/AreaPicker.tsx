import { ChevronDown, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@chakra-ui/react';
import { cn } from '@/lib/utils';
import { createArea, useAreaList } from './useAreas';

interface AreaPickerProps {
  locationId: string | undefined;
  value: string | null;
  onChange: (areaId: string | null) => void;
}

export function AreaPicker({ locationId, value, onChange }: AreaPickerProps) {
  const { areas } = useAreaList(locationId);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedArea = areas.find((a) => a.id === value);

  const reposition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return;
    reposition();
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setCreating(false);
        setNewName('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, reposition]);

  // Focus input when creating
  useEffect(() => {
    if (creating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creating]);

  async function handleCreate() {
    if (!newName.trim() || !locationId || saving) return;
    setSaving(true);
    try {
      const area = await createArea(locationId, newName.trim());
      onChange(area.id);
      setNewName('');
      setCreating(false);
      setOpen(false);
    } catch {
      // Error handled silently — duplicate name will show in console
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center justify-between w-full h-10 rounded-[var(--radius-sm)] border border-black/6 dark:border-white/6 bg-gray-500/12 dark:bg-gray-500/24 px-3 text-[15px] text-left transition-colors',
          'hover:border-[var(--border-glass)] focus:outline-none focus:ring-2 focus:ring-purple-600 dark:focus:ring-purple-500',
          !selectedArea && 'text-gray-500 dark:text-gray-400'
        )}
      >
        <span className="truncate">{selectedArea ? selectedArea.name : 'No area'}</span>
        <ChevronDown className={cn('h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] rounded-[var(--radius-md)] border border-black/6 dark:border-white/6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl shadow-lg overflow-hidden"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-2.5 text-[15px] transition-colors hover:bg-gray-500/8 dark:hover:bg-gray-500/18',
                value === null ? 'text-purple-600 dark:text-purple-500 font-medium' : 'text-gray-500 dark:text-gray-400'
              )}
            >
              No area
            </button>
            {areas.map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => { onChange(area.id); setOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-2.5 text-[15px] transition-colors hover:bg-gray-500/8 dark:hover:bg-gray-500/18',
                  value === area.id && 'text-purple-600 dark:text-purple-500 font-medium'
                )}
              >
                {area.name}
              </button>
            ))}
          </div>

          <div className="border-t border-black/6 dark:border-white/6">
            {creating ? (
              <div className="flex items-center gap-2 p-2">
                <Input
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleCreate(); }
                    if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                  }}
                  placeholder="Area name..."
                  disabled={saving}
                  className="h-8 text-[14px] flex-1"
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newName.trim() || saving}
                  className="h-8 px-2.5 rounded-[var(--radius-sm)] bg-purple-600 dark:bg-purple-500 text-white text-[13px] font-medium disabled:opacity-40 transition-opacity"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setCreating(false); setNewName(''); }}
                  className="h-8 w-8 flex items-center justify-center rounded-[var(--radius-sm)] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-[14px] text-purple-600 dark:text-purple-500 hover:bg-gray-500/8 dark:hover:bg-gray-500/18 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create new area...
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
