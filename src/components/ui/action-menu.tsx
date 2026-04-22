import { MoreHorizontal } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useClickOutside } from '@/lib/useClickOutside';
import { useIsMobile } from '@/lib/useIsMobile';
import { cn } from '@/lib/utils';

const MenuCloseContext = createContext<() => void>(() => {});

interface ActionMenuProps {
  triggerClassName: string;
  triggerAriaLabel?: string;
  menuClassName?: string;
  children: React.ReactNode;
}

export function ActionMenu({
  triggerClassName,
  triggerAriaLabel = 'Actions',
  menuClassName,
  children,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const isMobile = useIsMobile();
  // Skip the listener when closed or on mobile (mobile uses Dialog's own dismissal).
  // Closed-menu skipping matters in lists that render N menus (e.g. bin items).
  useClickOutside(ref, close, !open || isMobile);

  const trigger = (
    <button
      type="button"
      aria-label={triggerAriaLabel}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      className={triggerClassName}
    >
      <MoreHorizontal className="h-4 w-4" />
    </button>
  );

  return (
    <MenuCloseContext.Provider value={close}>
      {isMobile ? (
        <>
          {trigger}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent
              className="sm:hidden rounded-b-none rounded-t-[var(--radius-xl)] p-0 max-h-[60vh]"
              flush
            >
              <div role="menu" className="py-1">{children}</div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div ref={ref} className="relative">
          {trigger}
          {open && (
            <div
              role="menu"
              className={cn(
                'absolute right-0 top-full mt-1.5 z-50 rounded-[var(--radius-md)] flat-popover overflow-hidden py-1',
                menuClassName,
              )}
            >
              {children}
            </div>
          )}
        </div>
      )}
    </MenuCloseContext.Provider>
  );
}

export function MenuItem({
  icon: Icon, label, onClick, destructive,
}: { icon: React.ElementType; label: string; onClick?: () => void; destructive?: boolean }) {
  const close = useContext(MenuCloseContext);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => { close(); onClick?.(); }}
      className={cn(
        'w-full px-3 py-2 flex items-center gap-2 text-left text-[13px] hover:bg-[var(--bg-active)]',
        destructive ? 'text-[var(--destructive)]' : 'text-[var(--text-primary)]',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-[var(--border-subtle)]" />;
}
