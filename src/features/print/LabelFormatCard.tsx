import { CheckCircle2, ChevronDown, Circle, LayoutGrid, RectangleHorizontal, RectangleVertical, Save, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { OptionGroup } from '@/components/ui/option-group';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { computeLabelsPerPage, filterLabelFormats } from './labelFormats';
import { inchesToMm } from './pdfUnits';
import type { FormatState } from './usePrintPageActions';
import { CUSTOM_FIELDS } from './usePrintPageActions';

interface LabelFormatCardProps {
  format: FormatState;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
}

export function LabelFormatCard({ format: f, expanded, onExpandedChange }: LabelFormatCardProps) {
  const [formatSearch, setFormatSearch] = useState('');
  const [presetName, setPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  function handleSave() {
    f.handleSavePreset(presetName);
    setPresetName('');
    setShowSaveInput(false);
  }

  return (
    <Card>
      <CardContent>
        <button
          type="button"
          className="flex items-center justify-between w-full"
          onClick={() => onExpandedChange(!expanded)}
        >
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-[var(--text-tertiary)]" />
            <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal pointer-events-none">Label Format</Label>
            {!expanded && (
              <span className="text-[13px] text-[var(--text-tertiary)]">({f.baseFormat.name})</span>
            )}
          </div>
          <ChevronDown className={cn(
            'h-5 w-5 text-[var(--text-tertiary)] transition-transform duration-200',
            expanded && 'rotate-180'
          )} />
        </button>

        {expanded && (
          <>
            {/* Format search */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)] pointer-events-none" />
              <input
                type="text"
                placeholder="Search by Avery product number..."
                value={formatSearch}
                onChange={(e) => setFormatSearch(e.target.value)}
                className="w-full h-9 rounded-[var(--radius-full)] bg-[var(--bg-input)] pl-9 pr-8 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-shadow"
              />
              {formatSearch && (
                <button
                  type="button"
                  onClick={() => setFormatSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {(() => {
              const filteredFormats = filterLabelFormats(formatSearch);
              return filteredFormats.length > 0 ? (
                <div className="space-y-1 mt-2">
                  {filteredFormats.map((fmt) => (
                    <button
                      type="button"
                      key={fmt.key}
                      className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 w-full text-left hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)] transition-colors"
                      onClick={() => f.handleFormatChange(fmt.key)}
                    >
                      {f.formatKey === fmt.key ? (
                        <CheckCircle2 className="h-[20px] w-[20px] text-[var(--accent)] shrink-0" />
                      ) : (
                        <Circle className="h-[20px] w-[20px] text-[var(--text-tertiary)] shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="text-[15px] text-[var(--text-primary)]">{fmt.name}</span>
                        <span className="text-[13px] text-[var(--text-tertiary)] ml-2">
                          {computeLabelsPerPage(fmt) > 1 ? `${computeLabelsPerPage(fmt)} per page` : 'single label'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[var(--text-tertiary)] py-6 text-center">
                  No matching label formats
                </p>
              );
            })()}

            {f.savedPresets.length > 0 && (
              <div className="space-y-1 mt-2 pt-2 border-t border-[var(--border-subtle)]">
                <span className="text-[12px] text-[var(--text-tertiary)] font-medium px-3">Saved Presets</span>
                {f.savedPresets.map((fmt) => (
                  <div key={fmt.key} className="flex items-center group">
                    <button
                      type="button"
                      className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 flex-1 min-w-0 text-left hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)] transition-colors"
                      onClick={() => f.handleFormatChange(fmt.key)}
                    >
                      {f.formatKey === fmt.key ? (
                        <CheckCircle2 className="h-[20px] w-[20px] text-[var(--accent)] shrink-0" />
                      ) : (
                        <Circle className="h-[20px] w-[20px] text-[var(--text-tertiary)] shrink-0" />
                      )}
                      <div className="min-w-0 truncate">
                        <span className="text-[15px] text-[var(--text-primary)]">{fmt.name}</span>
                        <span className="text-[13px] text-[var(--text-tertiary)] ml-2">
                          {f.displayUnit === 'mm'
                            ? `${inchesToMm(parseFloat(String(fmt.cellWidth).replace(/in$/, '')))}mm × ${inchesToMm(parseFloat(String(fmt.cellHeight).replace(/in$/, '')))}mm`
                            : `${fmt.cellWidth} × ${fmt.cellHeight}`}
                        </span>
                      </div>
                    </button>
                    <Tooltip content={`Delete ${fmt.name}`}>
                      <button
                        type="button"
                        className="shrink-0 p-2 mr-1 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--destructive)] hover:bg-[var(--bg-hover)] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        onClick={() => f.handleDeletePreset(fmt.key)}
                        aria-label={`Delete ${fmt.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  </div>
                ))}
              </div>
            )}

            {/* Orientation toggle */}
            <div className="flex items-center gap-1 mt-3 pt-3 border-t border-[var(--border-subtle)] px-1">
              <span className="text-[12px] text-[var(--text-secondary)] font-medium mr-2">Orientation</span>
              <OptionGroup
                options={[
                  { key: 'landscape' as const, label: 'Landscape', icon: RectangleHorizontal },
                  { key: 'portrait' as const, label: 'Portrait', icon: RectangleVertical },
                ]}
                value={f.effectiveOrientation}
                onChange={(v) => v !== f.effectiveOrientation && f.toggleOrientation()}
                renderContent={(opt) => {
                  const Icon = opt.icon;
                  return (
                    <span className="flex items-center justify-center gap-1.5">
                      {Icon && <Icon className={opt.key === 'landscape' ? 'h-4.5 w-4.5' : 'h-3.5 w-3.5'} />}
                      {opt.label}
                    </span>
                  );
                }}
              />
            </div>

            {/* Customize toggle */}
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
              <label htmlFor="customize-dimensions" className="flex items-center gap-3 px-3 py-1 cursor-pointer">
                <Checkbox
                  id="customize-dimensions"
                  checked={f.customState.customizing}
                  onCheckedChange={f.toggleCustomize}
                />
                <span className="text-[15px] text-[var(--text-primary)]">Customize dimensions</span>
              </label>
            </div>

            {f.customState.customizing && (
              <>
                <div className="flex items-center gap-1 mt-3 px-1">
                  <span className="text-[12px] text-[var(--text-secondary)] font-medium mr-2">Units</span>
                  <OptionGroup
                    options={[
                      { key: 'in' as const, label: 'Inches' },
                      { key: 'mm' as const, label: 'mm' },
                    ]}
                    value={f.displayUnit}
                    onChange={(v) => f.updateDisplayUnit(v)}
                    size="sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3 px-1">
                  {CUSTOM_FIELDS.map((field) => {
                    const unitSuffix = field.isDimensional ? ` (${f.displayUnit})` : '';
                    const step = f.displayUnit === 'mm' && field.isDimensional ? field.stepMm : field.stepIn;
                    const min = f.displayUnit === 'mm' && field.isDimensional ? String(inchesToMm(field.minIn)) : String(field.minIn);
                    return (
                      <div key={field.key} className="flex flex-col gap-1">
                        <label htmlFor={`custom-field-${field.key}`} className="text-[12px] text-[var(--text-secondary)] font-medium">
                          {field.label}{unitSuffix}
                        </label>
                        <input
                          id={`custom-field-${field.key}`}
                          type="number"
                          step={step}
                          min={min}
                          max={field.max}
                          value={f.getOverrideValue(field.key)}
                          onChange={(e) => f.updateOverride(field.key, e.target.value)}
                          className="h-9 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
                        />
                      </div>
                    );
                  })}
                </div>

                {showSaveInput ? (
                  <div className="flex items-center gap-2 mt-3 px-1">
                    <input
                      type="text"
                      placeholder="Preset name"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                      className="h-9 flex-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
                    />
                    <Button size="sm" onClick={handleSave} disabled={!presetName.trim()} className="h-9 px-3">
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setShowSaveInput(false); setPresetName(''); }}
                      className="h-9 px-2.5 text-[var(--text-tertiary)]"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSaveInput(true)}
                    className="mt-3 mx-1 text-[13px] text-[var(--accent)] h-9 px-3"
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    Save as Preset
                  </Button>
                )}
              </>
            )}

          </>
        )}
      </CardContent>
    </Card>
  );
}
