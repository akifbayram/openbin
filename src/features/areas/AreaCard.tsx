import { Check, MoreHorizontal, Plus, X } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import { AreaActionMenu } from './AreaActionMenu';
import { useInlineEdit } from './useInlineEdit';

interface AreaCardProps {
  id: string;
  name: string;
  binCount: number;
  isAdmin: boolean;
  index?: number;
  onNavigate: (areaId: string) => void;
  onRename: (id: string, newName: string) => Promise<void>;
  onDelete: (id: string, name: string, binCount: number) => void;
}

interface UnassignedCardProps {
  count: number;
  index?: number;
  onNavigate: () => void;
}

interface CreateCardProps {
  onCreate: () => void;
}

export function AreaCard({ id, name, binCount, isAdmin, index = 0, onNavigate, onRename, onDelete }: AreaCardProps) {
  const t = useTerminology();
  const { visible, animating, isOpen, close, toggle } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, close);

  const { editing, editValue, saving, startEdit: _startEdit, cancelEdit, setEditValue, handleSave, handleKeyDown } = useInlineEdit({
    currentName: name,
    onSave: (newName) => onRename(id, newName),
  });

  function startEdit() {
    _startEdit();
    close();
  }

  if (editing) {
    return (
      <div className="glass-card rounded-[var(--radius-lg)] p-4 flex flex-col gap-2">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          autoFocus
          className="h-8 text-[14px]"
        />
        <div className="flex gap-1.5 justify-end">
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
            onClick={cancelEdit}
            className="h-8 w-8 rounded-full shrink-0"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onNavigate(id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(id); } }}
      className={cn(
        "glass-card rounded-[var(--radius-lg)] p-4 cursor-pointer hover:bg-[var(--bg-hover)] transition-all duration-200 active:scale-[0.98] text-left relative group animate-stagger-in",
        "[@media(hover:hover)]:hover:shadow-[var(--shadow-elevated)] [@media(hover:hover)]:hover:-translate-y-0.5",
        isOpen && "z-10"
      )}
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      <span className="text-[15px] font-semibold text-[var(--text-primary)] truncate block pr-7">
        {name}
      </span>
      <span className="text-[13px] text-[var(--text-tertiary)] mt-1 block">
        {binCount} {binCount !== 1 ? t.bins : t.bin}
      </span>

      {isAdmin && (
        <div
          className="absolute top-2.5 right-2.5"
          ref={menuRef}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            className="h-9 w-9 rounded-full [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus:opacity-100 transition-opacity"
            aria-label="More actions"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
          <AreaActionMenu
            visible={visible}
            animating={animating}
            onRename={startEdit}
            onDelete={() => { close(); onDelete(id, name, binCount); }}
          />
        </div>
      )}
    </div>
  );
}

export function UnassignedAreaCard({ count, index = 0, onNavigate }: UnassignedCardProps) {
  const t = useTerminology();
  return (
    <button
      type="button"
      onClick={onNavigate}
      className="glass-card rounded-[var(--radius-lg)] p-4 cursor-pointer hover:bg-[var(--bg-hover)] transition-all duration-200 active:scale-[0.98] text-left animate-stagger-in [@media(hover:hover)]:hover:shadow-[var(--shadow-elevated)] [@media(hover:hover)]:hover:-translate-y-0.5"
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      <span className="text-[15px] font-semibold text-[var(--text-secondary)] truncate block">
        Unassigned
      </span>
      <span className="text-[13px] text-[var(--text-tertiary)] mt-1 block">
        {count} {count !== 1 ? t.bins : t.bin}
      </span>
    </button>
  );
}

export function CreateAreaCard({ onCreate }: CreateCardProps) {
  const t = useTerminology();
  return (
    <button
      type="button"
      onClick={onCreate}
      className="rounded-[var(--radius-lg)] p-4 cursor-pointer hover:bg-[var(--bg-hover)] transition-all duration-200 active:scale-[0.98] border-2 border-dashed border-[var(--border-glass)] bg-transparent flex flex-col items-center justify-center gap-1.5 text-[var(--text-tertiary)]"
    >
      <Plus className="h-5 w-5" />
      <span className="text-[13px] font-medium">{`Create ${t.Area}`}</span>
    </button>
  );
}
