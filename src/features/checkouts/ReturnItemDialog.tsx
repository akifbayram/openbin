import { Check } from 'lucide-react';
import { useState } from 'react';
import { BinPickerList } from '@/components/ui/bin-picker-list';
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
import { cn, focusRing } from '@/lib/utils';
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
          <DialogTitle>Return Item</DialogTitle>
          <DialogDescription>
            Choose where to return &ldquo;{itemName}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            aria-pressed={mode === 'origin'}
            onClick={() => { setMode('origin'); setTargetId(null); }}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-[var(--radius-md)] transition-colors duration-150 border flex items-center',
              focusRing,
              mode === 'origin'
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'text-[var(--text-primary)] border-[var(--border-flat)] hover:border-[var(--text-tertiary)]',
            )}
          >
            <div className="flex-1 min-w-0">
              <span className="text-[15px] truncate block">Original bin</span>
              {originBinName && (
                <span className={cn('text-[13px] truncate block', mode === 'origin' ? 'text-white/70' : 'text-[var(--text-tertiary)]')}>
                  {originBinName}
                </span>
              )}
            </div>
            <Check className={cn('h-4 w-4 shrink-0 ml-2 transition-opacity duration-150', mode === 'origin' ? 'opacity-100' : 'opacity-0')} />
          </button>

          <button
            type="button"
            aria-pressed={mode === 'different'}
            onClick={() => setMode('different')}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-[var(--radius-md)] transition-colors duration-150 border flex items-center',
              focusRing,
              mode === 'different'
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'text-[var(--text-primary)] border-[var(--border-flat)] hover:border-[var(--text-tertiary)]',
            )}
          >
            <span className="flex-1 text-[15px] truncate">Different bin</span>
            <Check className={cn('h-4 w-4 shrink-0 ml-2 transition-opacity duration-150', mode === 'different' ? 'opacity-100' : 'opacity-0')} />
          </button>
        </div>

        {mode === 'different' && (
          <BinPickerList
            excludeBinId={binId}
            selectedBinId={targetId}
            onSelect={setTargetId}
            search={search}
            onSearchChange={setSearch}
            paused={!open}
          />
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleReturn} disabled={loading || !canSubmit}>
            {loading ? 'Returning...' : 'Return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
