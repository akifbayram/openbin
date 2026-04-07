import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import type { ItemCheckout } from '@/types';
import { returnItem } from './useCheckouts';

interface ReturnItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  binId: string;
  itemId: string;
  checkout: ItemCheckout;
}

export function ReturnItemDialog({ open, onOpenChange, itemName, binId, itemId }: ReturnItemDialogProps) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function handleReturn() {
    setLoading(true);
    try {
      await returnItem(binId, itemId);
      onOpenChange(false);
      showToast({ message: `${itemName} returned` });
    } catch {
      showToast({ message: 'Failed to return item' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return Item</DialogTitle>
          <DialogDescription>
            Return &ldquo;{itemName}&rdquo; to its original bin.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleReturn} disabled={loading}>
            {loading ? 'Returning...' : 'Return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
