import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BinIconBadge } from '@/components/ui/bin-icon-badge';
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
import { useBinList } from '@/features/bins/useBins';
import { resolveColor } from '@/lib/colorPalette';
import { resolveIcon } from '@/lib/iconMap';
import { cn, inputBase } from '@/lib/utils';
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
  const { bins } = useBinList(undefined, 'name', undefined, !open);

  const otherBins = useMemo(() => {
    let list = bins.filter((b) => b.id !== binId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b) =>
        b.name.toLowerCase().includes(q) || b.area_name?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [bins, binId, search]);

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
            onClick={() => { setMode('origin'); setTargetId(null); }}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-[var(--radius-md)] transition-colors border flex items-center',
              mode === 'origin'
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'text-[var(--text-primary)] border-[var(--border-flat)] hover:border-[var(--text-tertiary)]',
            )}
          >
            <span className="flex-1 text-[15px] truncate">
              Original bin{originBinName ? ` \u2014 ${originBinName}` : ''}
            </span>
            <Check className={cn('h-4 w-4 shrink-0 ml-2 transition-opacity', mode === 'origin' ? 'opacity-100' : 'opacity-0')} />
          </button>

          <button
            type="button"
            onClick={() => setMode('different')}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-[var(--radius-md)] transition-colors border flex items-center',
              mode === 'different'
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'text-[var(--text-primary)] border-[var(--border-flat)] hover:border-[var(--text-tertiary)]',
            )}
          >
            <span className="flex-1 text-[15px] truncate">Different bin</span>
            <Check className={cn('h-4 w-4 shrink-0 ml-2 transition-opacity', mode === 'different' ? 'opacity-100' : 'opacity-0')} />
          </button>
        </div>

        {mode === 'different' && (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bins..."
              className={cn(inputBase, 'h-9 text-[14px]')}
            />
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
              {otherBins.length === 0 ? (
                <p className="text-[13px] text-[var(--text-tertiary)] text-center py-4">
                  {search ? 'No matching bins' : 'No other bins available'}
                </p>
              ) : (
                otherBins.map((b) => {
                  const BinIcon = resolveIcon(b.icon);
                  const colorPreset = resolveColor(b.color);
                  const isSelected = targetId === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setTargetId(b.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-[var(--radius-sm)] transition-colors flex items-center gap-2 border',
                        isSelected
                          ? 'bg-[var(--accent)]/10 border-[var(--accent)]'
                          : 'border-transparent hover:bg-[var(--bg-hover)]',
                      )}
                    >
                      <BinIconBadge icon={BinIcon} colorPreset={colorPreset} />
                      <div className="flex-1 min-w-0">
                        <span className="text-[14px] truncate block text-[var(--text-primary)]">{b.name}</span>
                        {b.area_name && (
                          <span className="text-[12px] text-[var(--text-tertiary)] truncate block">{b.area_name}</span>
                        )}
                      </div>
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
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
