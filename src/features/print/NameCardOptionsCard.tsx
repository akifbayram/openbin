import { ChevronDown, Palette, Smile, Type } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { OptionGroup } from '@/components/ui/option-group';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import { CopiesStepper } from './CopiesStepper';
import type { NameCardOptions } from './usePrintSettings';

const FONT_SCALE_PRESETS = [
  { label: 'Compact', value: 0.75 },
  { label: 'Normal', value: 1 },
  { label: 'Large', value: 1.25 },
  { label: 'X-Large', value: 1.5 },
];

interface NameCardOptionsCardProps {
  options: NameCardOptions;
  onUpdate: <K extends keyof NameCardOptions>(key: K, value: NameCardOptions[K]) => void;
  copies: number;
  onUpdateCopies: (copies: number) => void;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
}

export function NameCardOptionsCard({ options, onUpdate, copies, onUpdateCopies, expanded, onExpandedChange }: NameCardOptionsCardProps) {
  const t = useTerminology();

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
            <Type className="h-4 w-4 text-[var(--text-tertiary)]" />
            <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal pointer-events-none">Name Options</Label>
          </div>
          <ChevronDown className={cn(
            'h-5 w-5 text-[var(--text-tertiary)] transition-transform duration-200',
            expanded && 'rotate-180',
          )} />
        </button>

        {expanded && (
          <div className="mt-3 space-y-4">
            <div className="space-y-1 px-1">
              {([
                { key: 'showIcon' as const, label: `${t.Bin} Icon`, icon: Smile },
                { key: 'showColor' as const, label: 'Color Background', icon: Palette },
              ] as const).map(({ key, label, icon: Icon }) => (
                <label key={key} htmlFor={`name-opt-${key}`} className="flex items-center gap-3 px-2 py-1.5 cursor-pointer rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] transition-colors">
                  <Checkbox
                    id={`name-opt-${key}`}
                    checked={options[key]}
                    onCheckedChange={(checked) => onUpdate(key, !!checked)}
                  />
                  <Icon className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
                  <span className="text-[15px] text-[var(--text-primary)]">{label}</span>
                </label>
              ))}
            </div>

            <div className="px-1">
              <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">Font Sizing</span>
              <OptionGroup
                options={[
                  { key: 'auto', label: 'Auto-fit' },
                  { key: 'uniform', label: 'Uniform' },
                ]}
                value={options.sizingMode}
                onChange={(v) => onUpdate('sizingMode', v as 'auto' | 'uniform')}
                size="sm"
              />
            </div>

            {options.sizingMode === 'uniform' && (
              <div className="px-1">
                <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">Font Size</span>
                <OptionGroup
                  options={FONT_SCALE_PRESETS.map((p) => ({ key: String(p.value), label: p.label }))}
                  value={String(options.fontScale)}
                  onChange={(v) => onUpdate('fontScale', Number(v))}
                  size="sm"
                />
              </div>
            )}

            <CopiesStepper label="Copies per card" value={copies} onChange={onUpdateCopies} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
