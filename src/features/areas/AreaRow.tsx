import { useState, useRef, useEffect } from 'react';
import { Pencil, Trash2, Check, X, MoreHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTerminology } from '@/lib/terminology';

interface AreaRowProps {
  id: string;
  name: string;
  binCount: number;
  isOwner: boolean;
  onNavigate: (areaId: string) => void;
  onRename: (id: string, newName: string) => Promise<void>;
  onDelete: (id: string, name: string, binCount: number) => void;
}

export function AreaRow({ id, name, binCount, isOwner, onNavigate, onRename, onDelete }: AreaRowProps) {
  const t = useTerminology();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!actionsOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [actionsOpen]);

  function startEdit() {
    setEditValue(name);
    setEditing(true);
    setActionsOpen(false);
  }

  async function handleSave() {
    if (!editValue.trim() || editValue.trim() === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(id, editValue.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
            if (e.key === 'Escape') { setEditing(false); }
          }}
          disabled={saving}
          autoFocus
          className="h-8 text-[14px] flex-1"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSave}
          disabled={!editValue.trim() || saving}
          className="h-8 w-8 rounded-full shrink-0"
          aria-label="Save"
        >
          <Check className="h-4 w-4 text-[var(--accent)]" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setEditing(false)}
          className="h-8 w-8 rounded-full shrink-0"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-hover)] transition-colors">
      <button
        className="flex-1 min-w-0 text-left cursor-pointer"
        onClick={() => onNavigate(id)}
      >
        <span className="text-[15px] font-medium text-[var(--text-primary)] truncate block">
          {name}
        </span>
      </button>
      <span className="text-[13px] text-[var(--text-tertiary)] shrink-0 tabular-nums">
        {binCount} {binCount !== 1 ? t.bins : t.bin}
      </span>
      {isOwner && (
        <div className="relative" ref={menuRef}>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); setActionsOpen(!actionsOpen); }}
            className="h-7 w-7 rounded-full"
            aria-label="More actions"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
          {actionsOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[140px] glass-heavy rounded-[var(--radius-lg)] py-1 shadow-lg border border-[var(--border-glass)]">
              <button
                onClick={(e) => { e.stopPropagation(); startEdit(); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Pencil className="h-4 w-4" />
                Rename
              </button>
              <div className="my-1 border-t border-[var(--border-glass)]" />
              <button
                onClick={(e) => { e.stopPropagation(); setActionsOpen(false); onDelete(id, name, binCount); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] text-[var(--destructive)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
