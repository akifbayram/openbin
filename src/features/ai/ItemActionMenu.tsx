import { ExternalLink, Hash, PackageMinus, Pencil, Trash2, Undo2 } from 'lucide-react';
import { ActionMenu, MenuDivider, MenuItem } from '@/components/ui/action-menu';

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
  return (
    <ActionMenu
      triggerAriaLabel="Item actions"
      triggerClassName="shrink-0 inline-flex items-center justify-center h-8 w-8 -mr-1 rounded-[var(--radius-xs)] text-[var(--text-tertiary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)] transition-colors"
      menuClassName="min-w-[180px]"
    >
      {isTrashed ? (
        <MenuItem icon={Undo2} label="Restore & open" onClick={onRestoreBin ?? onOpenBin} />
      ) : (
        <>
          <MenuItem icon={ExternalLink} label="Open bin" onClick={onOpenBin} />
          {canWrite && (
            <>
              <MenuDivider />
              <MenuItem icon={PackageMinus} label="Checkout" onClick={onCheckout} />
              <MenuItem icon={Hash} label="Adjust quantity" onClick={onAdjustQuantity} />
              <MenuItem icon={Pencil} label="Rename" onClick={onRename} />
              <MenuDivider />
              <MenuItem icon={Trash2} label="Remove" onClick={onRemove} destructive />
            </>
          )}
        </>
      )}
    </ActionMenu>
  );
}
