import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Bin, Photo } from '@/types';
import { BinDetailAppearanceTab } from './BinDetailAppearanceTab';
import type { useAutoSaveBin } from './useAutoSaveBin';

interface BinAppearanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bin: Bin;
  autoSave: ReturnType<typeof useAutoSaveBin>;
  photos: Photo[];
}

export function BinAppearanceDialog({ open, onOpenChange, bin, autoSave, photos }: BinAppearanceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customize appearance</DialogTitle>
          <DialogDescription>
            Changes save automatically.
          </DialogDescription>
        </DialogHeader>
        <BinDetailAppearanceTab bin={bin} autoSave={autoSave} photos={photos} />
      </DialogContent>
    </Dialog>
  );
}
