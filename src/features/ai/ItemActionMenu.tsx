import { ExternalLink, Hash, MoreHorizontal, PackageMinus, Pencil, Trash2, Undo2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useClickOutside } from '@/lib/useClickOutside';
import { useIsMobile } from '@/lib/useIsMobile';
import { cn } from '@/lib/utils';

interface ItemActionMenuProps {
  onOpenBin: () => void;
  onCheckout?: () => void;
  onAdjustQuantity?: () => void;
  onRename?: () => void;
  onRemove?: () => void;
  onRestoreBin?: () => void;
  canWrite: boolean;
  isTrashed: boolean;
}

export function ItemActionMenu({
  onOpenBin, onCheckout, onAdjustQuantity, onRename, onRemove, onRestoreBin,
  canWrite, isTrashed,
}: ItemActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, useCallback(() => setOpen(false), []));
  const isMobile = useIsMobile();

  function run(action?: () => void) {
    return () => {
      setOpen(false);
      action?.();
    };
  }

  const menuItems = isTrashed ? (
    <MenuItem icon={Undo2} label="Restore & open" onClick={run(onRestoreBin ?? onOpenBin)} />
  ) : (
    <>
      <MenuItem icon={ExternalLink} label="Open bin" onClick={run(onOpenBin)} />
      {canWrite && (
        <>
          <Divider />
          <MenuItem icon={PackageMinus} label="Checkout" onClick={run(onCheckout)} />
          <MenuItem icon={Hash} label="Adjust quantity" onClick={run(onAdjustQuantity)} />
          <MenuItem icon={Pencil} label="Rename" onClick={run(onRename)} />
          <Divider />
          <MenuItem icon={Trash2} label="Remove" onClick={run(onRemove)} destructive />
        </>
      )}
    </>
  );

  const trigger = (
    <button
      type="button"
      aria-label="Item actions"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      className="shrink-0 inline-flex items-center justify-center h-8 w-8 -mr-1 rounded-[var(--radius-xs)] text-[var(--text-tertiary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)] transition-colors"
    >
      <MoreHorizontal className="h-4 w-4" />
    </button>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            className="sm:hidden rounded-b-none rounded-t-[var(--radius-xl)] p-0 max-h-[60vh]"
            flush
          >
            <div role="menu" className="py-2">
              {menuItems}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute right-0 top-full mt-1.5 z-50 min-w-[180px]',
            'rounded-[var(--radius-md)] flat-popover overflow-hidden',
          )}
        >
          {menuItems}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon, label, onClick, destructive,
}: { icon: React.ElementType; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
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

function Divider() {
  return <div className="h-px bg-[var(--border-subtle)]" />;
}
