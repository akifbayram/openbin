import {
  CheckSquare,
  ChevronDown,
  Edit3,
  Hash,
  ListOrdered,
  type LucideIcon,
  MapPin,
  Palette,
  PlusSquare,
  QrCode,
  Rows,
  StickyNote,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import { CopiesStepper } from './CopiesStepper';
import type { ItemListOptions } from './usePrintSettings';

interface ItemListOptionsCardProps {
  options: ItemListOptions;
  onUpdate: <K extends keyof ItemListOptions>(key: K, value: ItemListOptions[K]) => void;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
}

export function ItemListOptionsCard({ options, onUpdate, expanded, onExpandedChange }: ItemListOptionsCardProps) {
  const t = useTerminology();

  // `as const` narrows each `key` to its literal type so onUpdate's generic K
  // resolves per-row and type inference works without casts.
  const headerRows = [
    { key: 'showQrCode', label: 'QR code', icon: QrCode },
    { key: 'showIcon', label: 'Icon & color', icon: Palette },
    { key: 'showAreaPath', label: 'Area path', icon: MapPin },
    { key: 'showBinCode', label: `${t.Bin} code`, icon: Hash },
    { key: 'showItemCount', label: 'Item count', icon: ListOrdered },
  ] as const;

  const contentRows = [
    { key: 'showCheckboxes', label: 'Checkboxes', icon: CheckSquare },
    { key: 'showQuantity', label: 'Quantity', icon: Hash },
    { key: 'showNotesColumn', label: 'Write-in notes column', icon: Edit3 },
    { key: 'showBinNotes', label: `${t.Bin} notes`, icon: StickyNote },
  ] as const;

  const layoutRows = [
    { key: 'zebraStripes', label: 'Alternating row shading', icon: Rows },
  ] as const;

  const renderRow = <K extends 'showQrCode' | 'showIcon' | 'showAreaPath' | 'showBinCode' | 'showItemCount' | 'showCheckboxes' | 'showQuantity' | 'showNotesColumn' | 'showBinNotes' | 'zebraStripes'>({
    key,
    label,
    icon: Icon,
  }: { key: K; label: string; icon: LucideIcon }) => (
    <label
      key={key}
      htmlFor={`item-opt-${key}`}
      className="flex items-center gap-3 px-2 py-1.5 cursor-pointer rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] transition-colors"
    >
      <Checkbox
        id={`item-opt-${key}`}
        checked={options[key]}
        onCheckedChange={(checked) => onUpdate(key, !!checked)}
      />
      <Icon className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
      <span className="text-[15px] text-[var(--text-primary)]">{label}</span>
    </label>
  );

  return (
    <Card>
      <CardContent>
        <button
          type="button"
          className="row-spread w-full"
          aria-expanded={expanded}
          onClick={() => onExpandedChange(!expanded)}
        >
          <div className="row">
            <ListOrdered className="h-4 w-4 text-[var(--text-tertiary)]" />
            <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal pointer-events-none">List Options</Label>
          </div>
          <ChevronDown className={cn(
            'h-5 w-5 text-[var(--text-tertiary)] transition-transform duration-200',
            expanded && 'rotate-180',
          )} />
        </button>

        {expanded && (
          <div className="mt-3 px-1">
            <SubsectionHeader title="Header" />
            <div className="space-y-1">{headerRows.map(renderRow)}</div>

            <SubsectionHeader title="Content" />
            <div className="space-y-1">{contentRows.map(renderRow)}</div>

            <SubsectionHeader title="Layout" />
            <div className="space-y-1">{layoutRows.map(renderRow)}</div>

            <CopiesStepper
              label="Blank rows at end"
              icon={PlusSquare}
              value={options.blankRowCount}
              onChange={(v) => onUpdate('blankRowCount', Math.max(0, Math.min(20, v)))}
              min={0}
              max={20}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubsectionHeader({ title }: { title: string }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-2 pt-3 pb-1">
      {title}
    </div>
  );
}
