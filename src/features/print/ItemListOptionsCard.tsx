import { CheckSquare, ChevronDown, Hash, SlidersHorizontal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import type { ItemListOptions } from './usePrintSettings';

interface ItemListOptionsCardProps {
  options: ItemListOptions;
  onUpdate: <K extends keyof ItemListOptions>(key: K, value: ItemListOptions[K]) => void;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
}

export function ItemListOptionsCard({ options, onUpdate, expanded, onExpandedChange }: ItemListOptionsCardProps) {
  const t = useTerminology();

  return (
    <Card>
      <CardContent>
        <button
          type="button"
          className="row-spread w-full"
          onClick={() => onExpandedChange(!expanded)}
        >
          <div className="row">
            <SlidersHorizontal className="h-4 w-4 text-[var(--text-tertiary)]" />
            <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal pointer-events-none">List Options</Label>
          </div>
          <ChevronDown className={cn(
            'h-5 w-5 text-[var(--text-tertiary)] transition-transform duration-200',
            expanded && 'rotate-180'
          )} />
        </button>

        {expanded && (
          <div className="mt-3 space-y-1 px-1">
            {([
              { key: 'showCheckboxes' as const, label: 'Checkboxes', icon: CheckSquare },
              { key: 'showQuantity' as const, label: 'Quantity', icon: Hash },
              { key: 'showBinCode' as const, label: `${t.Bin} Code`, icon: Hash },
            ] as const).map(({ key, label, icon: Icon }) => (
              <label key={key} htmlFor={`item-opt-${key}`} className="flex items-center gap-3 px-2 py-1.5 cursor-pointer rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] transition-colors">
                <Checkbox
                  id={`item-opt-${key}`}
                  checked={options[key]}
                  onCheckedChange={(checked) => onUpdate(key, !!checked)}
                />
                <Icon className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
                <span className="text-[15px] text-[var(--text-primary)]">{label}</span>
              </label>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
