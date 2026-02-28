import { CheckCircle2, Circle, ChevronDown, Save, X, RectangleHorizontal, RectangleVertical, Search, LayoutGrid } from 'lucide-react';
import { OptionGroup } from '@/components/ui/option-group';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { computeLabelsPerPage, filterLabelFormats } from './labelFormats';
import { inchesToMm } from './pdfUnits';
import { CUSTOM_FIELDS } from './usePrintPageActions';
import type { LabelFormat } from './labelFormats';
import type { CustomState, DisplayUnit } from './usePrintSettings';

interface LabelFormatCardProps {
  formatKey: string;
  baseFormat: LabelFormat;
  effectiveOrientation: 'landscape' | 'portrait';
  customState: CustomState;
  displayUnit: DisplayUnit;
  savedPresets: LabelFormat[];
  formatSearch: string;
  setFormatSearch: (v: string) => void;
  handleFormatChange: (key: string) => void;
  toggleCustomize: () => void;
  updateOverride: (key: keyof LabelFormat, raw: string) => void;
  getOverrideValue: (key: keyof LabelFormat) => string;
  toggleOrientation: () => void;
  updateDisplayUnit: (unit: DisplayUnit) => void;
  presetName: string;
  setPresetName: (v: string) => void;
  showSaveInput: boolean;
  setShowSaveInput: (v: boolean) => void;
  handleSavePreset: () => void;
  handleDeletePreset: (key: string) => void;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
}

export function LabelFormatCard({
  formatKey,
  baseFormat,
  effectiveOrientation,
  customState,
  displayUnit,
  savedPresets,
  formatSearch,
  setFormatSearch,
  handleFormatChange,
  toggleCustomize,
  updateOverride,
  getOverrideValue,
  toggleOrientation,
  updateDisplayUnit,
  presetName,
  setPresetName,
  showSaveInput,
  setShowSaveInput,
  handleSavePreset,
  handleDeletePreset,
  expanded,
  onExpandedChange,
}: LabelFormatCardProps) {
  return (
    <Card>
      <CardContent>
        <button
          className="flex items-center justify-between w-full"
          onClick={() => onExpandedChange(!expanded)}
        >
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-[var(--text-tertiary)]" />
            <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal pointer-events-none">Label Format</Label>
            {!expanded && (
              <span className="text-[13px] text-[var(--text-tertiary)]">({baseFormat.name})</span>
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
                      key={fmt.key}
                      className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 w-full text-left hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)] transition-colors"
                      onClick={() => handleFormatChange(fmt.key)}
                    >
                      {formatKey === fmt.key ? (
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

            {savedPresets.length > 0 && (
              <div className="space-y-1 mt-2 pt-2 border-t border-[var(--border-subtle)]">
                <span className="text-[12px] text-[var(--text-tertiary)] font-medium px-3">Saved Presets</span>
                {savedPresets.map((fmt) => (
                  <div key={fmt.key} className="flex items-center group">
                    <button
                      className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 flex-1 min-w-0 text-left hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)] transition-colors"
                      onClick={() => handleFormatChange(fmt.key)}
                    >
                      {formatKey === fmt.key ? (
                        <CheckCircle2 className="h-[20px] w-[20px] text-[var(--accent)] shrink-0" />
                      ) : (
                        <Circle className="h-[20px] w-[20px] text-[var(--text-tertiary)] shrink-0" />
                      )}
                      <div className="min-w-0 truncate">
                        <span className="text-[15px] text-[var(--text-primary)]">{fmt.name}</span>
                        <span className="text-[13px] text-[var(--text-tertiary)] ml-2">
                          {displayUnit === 'mm'
                            ? `${inchesToMm(parseFloat(String(fmt.cellWidth).replace(/in$/, '')))}mm × ${inchesToMm(parseFloat(String(fmt.cellHeight).replace(/in$/, '')))}mm`
                            : `${fmt.cellWidth} × ${fmt.cellHeight}`}
                        </span>
                      </div>
                    </button>
                    <Tooltip content={`Delete ${fmt.name}`}>
                      <button
                        className="shrink-0 p-2 mr-1 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--destructive)] hover:bg-[var(--bg-hover)] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        onClick={() => handleDeletePreset(fmt.key)}
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
                value={effectiveOrientation}
                onChange={(v) => v !== effectiveOrientation && toggleOrientation()}
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
              <label className="flex items-center gap-3 px-3 py-1 cursor-pointer">
                <Checkbox
                  checked={customState.customizing}
                  onCheckedChange={toggleCustomize}
                />
                <span className="text-[15px] text-[var(--text-primary)]">Customize dimensions</span>
              </label>
            </div>

            {customState.customizing && (
              <>
                <div className="flex items-center gap-1 mt-3 px-1">
                  <span className="text-[12px] text-[var(--text-secondary)] font-medium mr-2">Units</span>
                  <OptionGroup
                    options={[
                      { key: 'in' as const, label: 'Inches' },
                      { key: 'mm' as const, label: 'mm' },
                    ]}
                    value={displayUnit}
                    onChange={(v) => updateDisplayUnit(v)}
                    size="sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3 px-1">
                  {CUSTOM_FIELDS.map((field) => {
                    const unitSuffix = field.isDimensional ? ` (${displayUnit})` : '';
                    const step = displayUnit === 'mm' && field.isDimensional ? field.stepMm : field.stepIn;
                    const min = displayUnit === 'mm' && field.isDimensional ? String(inchesToMm(field.minIn)) : String(field.minIn);
                    return (
                      <div key={field.key} className="flex flex-col gap-1">
                        <label className="text-[12px] text-[var(--text-secondary)] font-medium">
                          {field.label}{unitSuffix}
                        </label>
                        <input
                          type="number"
                          step={step}
                          min={min}
                          max={field.max}
                          value={getOverrideValue(field.key)}
                          onChange={(e) => updateOverride(field.key, e.target.value)}
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
                      onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                      autoFocus
                      className="h-9 flex-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
                    />
                    <Button size="sm" onClick={handleSavePreset} disabled={!presetName.trim()} className="h-9 px-3">
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
