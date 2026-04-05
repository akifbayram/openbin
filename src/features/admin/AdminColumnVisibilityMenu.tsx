import { Columns3 } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';
import { cn } from '@/lib/utils';
import { ADMIN_FIELD_LABELS, type AdminFieldKey, TOGGLEABLE_FIELDS } from './useAdminColumnVisibility';

interface AdminColumnVisibilityMenuProps {
  visibility: Record<AdminFieldKey, boolean>;
  onToggle: (field: AdminFieldKey) => void;
}

export function AdminColumnVisibilityMenu({ visibility, onToggle }: AdminColumnVisibilityMenuProps) {
  const { visible, animating, close, toggle } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, close);

  return (
    <div ref={menuRef} className="relative">
      <Tooltip content="Columns" side="bottom">
        <Button
          variant="secondary"
          size="icon"
          onClick={toggle}
          className="shrink-0 rounded-[var(--radius-sm)]"
          aria-label="Toggle column visibility"
        >
          <Columns3 className="h-4 w-4" />
        </Button>
      </Tooltip>
      {visible && (
        <div className={cn(
          animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter',
          'absolute right-0 mt-1 w-52 max-h-80 overflow-y-auto rounded-[var(--radius-md)] flat-popover z-20',
        )}>
          <div className="px-3.5 py-2 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
            Visible Columns
          </div>
          {TOGGLEABLE_FIELDS.map((field) => (
            <label
              key={field}
              htmlFor={`admin-col-${field}`}
              className="w-full row-spread px-3.5 py-2 text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              {ADMIN_FIELD_LABELS[field]}
              <Switch
                id={`admin-col-${field}`}
                checked={visibility[field]}
                onCheckedChange={() => onToggle(field)}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
