import { ChevronDown, Palette, SlidersHorizontal, Smile } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { OptionGroup } from '@/components/ui/option-group';
import { useTerminology } from '@/lib/terminology';
import { cn } from '@/lib/utils';
import type { NameCardOptions } from './usePrintSettings';

interface NameCardOptionsCardProps {
  options: NameCardOptions;
  onUpdate: <K extends keyof NameCardOptions>(key: K, value: NameCardOptions[K]) => void;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
}

export function NameCardOptionsCard({ options, onUpdate, expanded, onExpandedChange }: NameCardOptionsCardProps) {
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
