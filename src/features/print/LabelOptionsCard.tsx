import { ChevronDown, AlignLeft, AlignCenter, Columns2, Rows2, SlidersHorizontal, QrCode, Type, Smile, Hash, Palette } from 'lucide-react';
import { OptionGroup } from '@/components/ui/option-group';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/lib/terminology';
import type { LabelOptions, LabelDirection } from './usePrintSettings';

const FONT_SCALE_PRESETS = [
  { label: 'S', value: 0.75 },
  { label: 'Default', value: 1 },
  { label: 'L', value: 1.25 },
  { label: 'XL', value: 1.5 },
];

interface LabelOptionsCardProps {
  labelOptions: LabelOptions;
  onUpdateOption: <K extends keyof LabelOptions>(key: K, value: LabelOptions[K]) => void;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
}

export function LabelOptionsCard({ labelOptions, onUpdateOption, expanded, onExpandedChange }: LabelOptionsCardProps) {
  const t = useTerminology();

  return (
    <Card>
      <CardContent>
        <button
          className="flex items-center justify-between w-full"
          onClick={() => onExpandedChange(!expanded)}
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[var(--text-tertiary)]" />
            <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal pointer-events-none">Label Options</Label>
          </div>
          <ChevronDown className={cn(
            'h-5 w-5 text-[var(--text-tertiary)] transition-transform duration-200',
            expanded && 'rotate-180'
          )} />
        </button>

        {expanded && (
          <div className="mt-3 space-y-4">
            <div className="px-1">
              <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">Font Size</span>
              <OptionGroup
                options={FONT_SCALE_PRESETS.map((p) => ({ key: String(p.value), label: p.label }))}
                value={String(labelOptions.fontScale)}
                onChange={(v) => onUpdateOption('fontScale', Number(v))}
                size="sm"
              />
            </div>

            <div className="px-1">
              <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">Text Alignment</span>
              <OptionGroup
                options={[
                  { key: 'left' as const, label: 'Left', icon: AlignLeft },
                  { key: 'center' as const, label: 'Center', icon: AlignCenter },
                ]}
                value={labelOptions.textAlign}
                onChange={(v) => onUpdateOption('textAlign', v)}
                size="sm"
              />
            </div>

            <div className="px-1">
              <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">Label Direction</span>
              <OptionGroup
                options={[
                  { key: 'auto' as const, label: 'Auto' },
                  { key: 'horizontal' as const, label: 'Horizontal', icon: Columns2 },
                  { key: 'vertical' as const, label: 'Vertical', icon: Rows2 },
                ]}
                value={labelOptions.labelDirection ?? 'auto'}
                onChange={(v) => onUpdateOption('labelDirection', v as LabelDirection)}
                size="sm"
              />
            </div>

            <div className="space-y-1 px-1">
              <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-1">Visible Elements</span>
              {([
                { key: 'showQrCode' as const, label: 'QR Code', icon: QrCode },
                { key: 'showBinName' as const, label: `${t.Bin} Name`, icon: Type },
                { key: 'showIcon' as const, label: `${t.Bin} Icon`, icon: Smile },
                { key: 'showBinCode' as const, label: `${t.Bin} Code`, icon: Hash },
                { key: 'showColorSwatch' as const, label: 'Color Background', icon: Palette },
              ] as const).map(({ key, label, icon: Icon }) => (
                <label key={key} className="flex items-center gap-3 px-2 py-1.5 cursor-pointer rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] transition-colors">
                  <Checkbox
                    checked={labelOptions[key]}
                    onCheckedChange={(checked) => onUpdateOption(key, !!checked)}
                  />
                  <Icon className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
                  <span className="text-[15px] text-[var(--text-primary)]">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
