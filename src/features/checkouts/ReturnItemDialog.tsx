import { useState } from 'react';
import { BinPickerList } from '@/components/ui/bin-picker-list';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioOption } from '@/components/ui/radio-option';
import { useToast } from '@/components/ui/toast';
import { returnItem } from './useCheckouts';

interface ReturnItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  binId: string;
  itemId: string;
  originBinName?: string;
}

export function ReturnItemDialog({ open, onOpenChange, itemName, binId, itemId, originBinName }: ReturnItemDialogProps) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'origin' | 'different'>('origin');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { showToast } = useToast();

  function handleOpenChange(next: boolean) {
    if (!next) {
      setMode('origin');
      setTargetId(null);
      setSearch('');
    }
    onOpenChange(next);
  }

  async function handleReturn() {
    setLoading(true);
    try {
      const target = mode === 'different' && targetId ? targetId : undefined;
      await returnItem(binId, itemId, target);
      handleOpenChange(false);
      showToast({ message: `${itemName} returned` });
    } catch {
      showToast({ message: 'Failed to return item' });
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = mode === 'origin' || targetId != null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return &ldquo;{itemName}&rdquo;</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <RadioOption
            selected={mode === 'origin'}
            onClick={() => { setMode('origin'); setTargetId(null); }}
            label="Original bin"
            description={originBinName}
          />
          <RadioOption
            selected={mode === 'different'}
            onClick={() => setMode('different')}
            label="Different bin"
          />
        </div>

        {mode === 'different' && (
          <div className="mt-3 animate-fade-in">
            <BinPickerList
              excludeBinId={binId}
              selectedBinId={targetId}
              onSelect={setTargetId}
              search={search}
              onSearchChange={setSearch}
              paused={!open}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleReturn} disabled={loading || !canSubmit}>
            {loading ? 'Returning…' : 'Return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
