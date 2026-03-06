import { Columns3 } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@chakra-ui/react';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';
import { FIELD_LABELS, type FieldKey } from './useColumnVisibility';

/** Shared field toggle list used by both ColumnVisibilityMenu and SearchBarOverflowMenu */
export function FieldToggleList({ fields, visibility, onToggle }: {
  fields: FieldKey[];
  visibility: Record<FieldKey, boolean>;
  onToggle: (field: FieldKey) => void;
}) {
  return (
    <>
      {fields.map((field) => (
        <button
          key={field}
          type="button"
          className="w-full flex items-center justify-between px-3.5 py-2 text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          onClick={() => onToggle(field)}
        >
          {FIELD_LABELS[field]}
          <Switch
            checked={visibility[field]}
            onCheckedChange={() => onToggle(field)}
          />
        </button>
      ))}
    </>
  );
}

interface ColumnVisibilityMenuProps {
  applicableFields: FieldKey[];
  visibility: Record<FieldKey, boolean>;
  onToggle: (field: FieldKey) => void;
}

export function ColumnVisibilityMenu({ applicableFields, visibility, onToggle }: ColumnVisibilityMenuProps) {
  const { visible, animating, close, toggle } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, close);

  return (
    <div ref={menuRef} className="relative">
      <Tooltip content="Fields" side="bottom">
        <Button
          variant="ghost"
          size="sm" px="0"
          onClick={toggle}
          className="shrink-0"
          aria-label="Toggle field visibility"
        >
          <Columns3 className="h-4 w-4" />
        </Button>
      </Tooltip>
      {visible && (
        <div className={`${animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter'} absolute right-0 mt-1 w-52 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] backdrop-blur-xl shadow-lg overflow-hidden z-20`}>
          <div className="px-3.5 py-2 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
            Visible Fields
          </div>
          <FieldToggleList fields={applicableFields} visibility={visibility} onToggle={onToggle} />
        </div>
      )}
    </div>
  );
}
