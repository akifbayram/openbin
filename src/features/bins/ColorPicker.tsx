import { useState } from 'react';
import { ChevronDown, ChevronUp, Ban } from 'lucide-react';
import { COLOR_PALETTE, getColorPreset } from '@/lib/colorPalette';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const preset = getColorPreset(value);
  const displayLabel = preset?.label ?? 'None';

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors border border-[var(--border-subtle)]"
      >
        {preset ? (
          <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: preset.dot }} />
        ) : (
          <span className="h-4 w-4 rounded-full shrink-0 border-2 border-[var(--text-tertiary)] flex items-center justify-center">
            <Ban className="h-3 w-3 text-[var(--text-tertiary)]" />
          </span>
        )}
        <span className="flex-1 text-left">{displayLabel}</span>
        {open ? <ChevronUp className="h-4 w-4 text-[var(--text-tertiary)]" /> : <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)]" />}
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 p-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          {/* Clear option */}
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            title="None"
            className={cn(
              'h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all',
              !value
                ? 'border-[var(--accent)] scale-110'
                : 'border-[var(--text-tertiary)] hover:scale-105'
            )}
          >
            <Ban className="h-4 w-4 text-[var(--text-tertiary)]" />
          </button>
          {COLOR_PALETTE.map((c) => {
            const isSelected = value === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => { onChange(c.key); setOpen(false); }}
                title={c.label}
                className={cn(
                  'h-8 w-8 rounded-full transition-all',
                  isSelected
                    ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-elevated)] scale-110'
                    : 'hover:scale-105'
                )}
                style={{ backgroundColor: c.dot }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
