import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAreaList, createArea } from './useAreas';
import { Input } from '@/components/ui/input';

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
          'flex items-center justify-between w-full h-10 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 text-[15px] text-left transition-colors',
          'hover:border-[var(--border-glass)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]',
          !selectedArea && 'text-[var(--text-tertiary)]'
        )}
      >
        <span className="truncate">{selectedArea ? selectedArea.name : 'No area'}</span>
        <ChevronDown className={cn('h-4 w-4 text-[var(--text-tertiary)] shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-lg overflow-hidden"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-2.5 text-[15px] transition-colors hover:bg-[var(--bg-hover)]',
                value === null ? 'text-[var(--accent)] font-medium' : 'text-[var(--text-tertiary)]'
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
                  'w-full text-left px-3 py-2.5 text-[15px] transition-colors hover:bg-[var(--bg-hover)]',
                  value === area.id && 'text-[var(--accent)] font-medium'
                )}
              >
                {area.name}
              </button>
            ))}
          </div>

          <div className="border-t border-[var(--border-subtle)]">
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
                  className="h-8 px-2.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-medium disabled:opacity-40 transition-opacity"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setCreating(false); setNewName(''); }}
                  className="h-8 w-8 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-[14px] text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors"
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
