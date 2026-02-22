import { useState } from 'react';

export type BulkDialog = 'tag' | 'area' | 'appearance' | 'visibility' | 'location';

export function useBulkDialogs() {
  const [openDialog, setOpenDialog] = useState<BulkDialog | null>(null);
  return {
    openDialog,
    open: (d: BulkDialog) => setOpenDialog(d),
    close: () => setOpenDialog(null),
    isOpen: (d: BulkDialog) => openDialog === d,
  };
}
