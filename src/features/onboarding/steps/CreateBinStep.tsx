import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { BinPreviewCard } from '@/features/bins/BinPreviewCard';
import { ItemList } from '@/features/bins/ItemList';
import { QuickAddWidget } from '@/features/bins/QuickAddWidget';
import { useQuickAdd } from '@/features/bins/useQuickAdd';
import type { BinItem } from '@/types';

export interface CreateBinStepProps {
  locationId: string;
  binName: string;
  setBinName: (v: string) => void;
  binItems: BinItem[];
  setBinItems: (v: BinItem[]) => void;
  binAreaId: string | null;
  setBinAreaId: (v: string | null) => void;
  areaNames: string[];
  handleCreateBin: () => void;
  loading: boolean;
  t: { bin: string; Bin: string };
}

export function CreateBinStep({
  locationId, binName, setBinName,
  binItems, setBinItems,
  binAreaId, setBinAreaId,
  areaNames, handleCreateBin, loading, t,
}: CreateBinStepProps) {
  const quickAdd = useQuickAdd({
    binName,
    existingItems: binItems.map((i) => i.name),
    activeLocationId: locationId,
    onAdd: (newItems) => setBinItems([...binItems, ...newItems]),
  });

  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="text-[22px] font-bold text-[var(--text-primary)] mb-2">
        Create your first {t.bin}
      </h2>
      <p className="text-[14px] text-[var(--text-tertiary)] mb-5 leading-relaxed">
        A {t.bin} is any container you want to track — a box, drawer, shelf, etc.
      </p>
      <BinPreviewCard
        name={binName || `My ${t.Bin}`}
        color=""
        items={binItems.map((i) => i.name)}
        tags={[]}
        className="mb-5"
      />
      <div className="w-full space-y-3 text-left">
        <Input
          value={binName}
          onChange={(e) => setBinName(e.target.value.slice(0, 100))}
          onKeyDown={(e) => { if (e.key === 'Enter' && binName.trim()) handleCreateBin(); }}
          placeholder={`${t.Bin} name`}
          maxLength={100}
          autoFocus
          className="rounded-[var(--radius-md)]"
        />
        {areaNames.length > 0 && (
          <AreaPicker
            locationId={locationId}
            value={binAreaId}
            onChange={setBinAreaId}
          />
        )}
        <ItemList items={binItems} onItemsChange={setBinItems} />
        <QuickAddWidget quickAdd={quickAdd} aiEnabled={false} />
      </div>
      <Button
        type="button"
        onClick={handleCreateBin}
        disabled={!binName.trim() || loading}
        className="w-full rounded-[var(--radius-md)] h-11 text-[15px] mt-5"
      >
        {loading ? 'Creating...' : `Create ${t.Bin}`}
      </Button>
    </div>
  );
}
