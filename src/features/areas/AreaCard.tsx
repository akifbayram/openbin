import { Check, Folder, Inbox, MoreHorizontal, Plus, X } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { useTerminology } from '@/lib/terminology';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';
import { cn } from '@/lib/utils';
import { AreaActionMenu } from './AreaActionMenu';
import { useInlineEdit } from './useInlineEdit';

interface AreaCardProps {
  id: string;
  name: string;
  binCount: number;
  isAdmin: boolean;
  onNavigate: (areaId: string) => void;
  onRename: (id: string, newName: string) => Promise<void>;
  onDelete: (id: string, name: string, binCount: number) => void;
}

interface UnassignedCardProps {
  count: number;
  onNavigate: () => void;
}

interface CreateCardProps {
  onCreate: () => void;
}

export function AreaCard({ id, name, binCount, isAdmin, onNavigate, onRename, onDelete }: AreaCardProps) {
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
          <Tooltip content="Save">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleSave}
              disabled={!editValue.trim() || saving}
              className="shrink-0"
              aria-label="Save"
            >
              <Check className="h-4 w-4 text-[var(--accent)]" />
            </Button>
          </Tooltip>
          <Tooltip content="Cancel">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={cancelEdit}
              className="shrink-0"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: custom card with contextual menu cannot be a plain button
    <div
      role="button"
      tabIndex={0}
      onClick={() => onNavigate(id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(id); } }}
      className={cn(
        "glass-card rounded-[var(--radius-lg)] p-4 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors duration-150 active:bg-[var(--bg-active)] text-left relative group",
        isOpen && "z-10"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--accent)]/10 flex items-center justify-center shrink-0 mt-0.5">
          <Folder className="h-4.5 w-4.5 text-[var(--accent)]" />
        </div>
        <div className="flex-1 min-w-0 pr-7">
          <span className="text-[15px] font-semibold text-[var(--text-primary)] truncate block">
            {name}
          </span>
          <span className="text-[13px] text-[var(--text-tertiary)] mt-0.5 block">
            {binCount} {binCount !== 1 ? t.bins : t.bin}
          </span>
        </div>
      </div>

      {isAdmin && (
        <div
          className="absolute top-2.5 right-2.5"
          ref={menuRef}
        >
          <Tooltip content="More actions" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); toggle(); }}
              className="[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus:opacity-100 transition-opacity"
              aria-label="More actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
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

export function UnassignedAreaCard({ count, onNavigate }: UnassignedCardProps) {
  const t = useTerminology();
  return (
    <button
      type="button"
      onClick={onNavigate}
      className="glass-card rounded-[var(--radius-lg)] p-4 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors duration-150 active:bg-[var(--bg-active)] text-left"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--bg-input)] flex items-center justify-center shrink-0 mt-0.5">
          <Inbox className="h-4.5 w-4.5 text-[var(--text-tertiary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[15px] font-semibold text-[var(--text-secondary)] truncate block">
            Unassigned
          </span>
          <span className="text-[13px] text-[var(--text-tertiary)] mt-0.5 block">
            {count} {count !== 1 ? t.bins : t.bin}
          </span>
        </div>
      </div>
    </button>
  );
}

export function CreateAreaCard({ onCreate }: CreateCardProps) {
  const t = useTerminology();
  return (
    <button
      type="button"
      onClick={onCreate}
      className="rounded-[var(--radius-lg)] p-4 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors duration-150 active:bg-[var(--bg-active)] border-2 border-dashed border-[var(--border-glass)] bg-transparent flex items-center gap-3 text-[var(--text-tertiary)]"
    >
      <div className="h-9 w-9 rounded-[var(--radius-sm)] border-2 border-dashed border-[var(--border-glass)] flex items-center justify-center shrink-0">
        <Plus className="h-4 w-4" />
      </div>
      <span className="text-[13px] font-medium">{`Create ${t.Area}`}</span>
    </button>
  );
}
