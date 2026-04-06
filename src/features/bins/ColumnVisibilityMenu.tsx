import { Columns3 } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';
import { cn } from '@/lib/utils';
import { FIELD_LABELS, type FieldKey } from './useColumnVisibility';

/** Shared field toggle list used by both ColumnVisibilityMenu and SearchBarOverflowMenu */
export function FieldToggleList({ fields, visibility, onToggle, customFieldLabels }: {
  fields: string[];
  visibility: Record<string, boolean>;
  onToggle: (field: string) => void;
  customFieldLabels?: Record<string, string>;
}) {
  return (
    <>
      {fields.map((field) => {
        const label = customFieldLabels?.[field] ?? FIELD_LABELS[field as FieldKey];
        const checked = visibility[field] ?? field.startsWith('cf_');
        return (
          <label
            key={field}
            htmlFor={`field-toggle-${field}`}
            className="w-full row-spread px-3.5 py-2 text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            {label}
            <Switch
              id={`field-toggle-${field}`}
              checked={checked}
              onCheckedChange={() => onToggle(field)}
            />
          </label>
        );
      })}
    </>
  );
}

interface ColumnVisibilityMenuProps {
  applicableFields: string[];
  visibility: Record<string, boolean>;
  onToggle: (field: string) => void;
  customFieldLabels?: Record<string, string>;
}

export function ColumnVisibilityMenu({ applicableFields, visibility, onToggle, customFieldLabels }: ColumnVisibilityMenuProps) {
  const { visible, animating, close, toggle } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, close);

  return (
    <div ref={menuRef} className="relative">
      <Tooltip content="Fields" side="bottom">
        <Button
          variant="secondary"
          size="icon"
          onClick={toggle}
          className="shrink-0 rounded-[var(--radius-sm)]"
          aria-label="Toggle field visibility"
        >
          <Columns3 className="h-4 w-4" />
        </Button>
      </Tooltip>
      {visible && (
        <div className={cn(
          animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter',
          'absolute right-0 mt-1 w-52 rounded-[var(--radius-md)] flat-popover overflow-hidden z-20',
        )}>
          <div className="px-3.5 py-2 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
            Visible Fields
          </div>
          <FieldToggleList fields={applicableFields} visibility={visibility} onToggle={onToggle} customFieldLabels={customFieldLabels} />
        </div>
      )}
    </div>
  );
}
