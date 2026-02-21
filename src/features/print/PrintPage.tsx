import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, CheckCircle2, Circle, ChevronDown, Save, X, RectangleHorizontal, RectangleVertical, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useBinList } from '@/features/bins/useBins';
import { useAreaList } from '@/features/areas/useAreas';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { LabelSheet } from './LabelSheet';
import { LABEL_FORMATS, getLabelFormat, DEFAULT_LABEL_FORMAT, getOrientation, computeLabelsPerPage, computePageSize } from './labelFormats';
import { usePrintSettings } from './usePrintSettings';
import type { LabelFormat } from './labelFormats';
import type { LabelOptions, CustomState } from './usePrintSettings';
import type { Bin } from '@/types';

function computeScaleFactor(base: LabelFormat, custom: LabelFormat): number {
  const baseW = parseFloat(base.cellWidth);
  const baseH = parseFloat(base.cellHeight);
  const customW = parseFloat(custom.cellWidth);
  const customH = parseFloat(custom.cellHeight);
  if (!baseW || !baseH) return 1;
  return Math.min(customW / baseW, customH / baseH);
}

function scaleValue(value: string, factor: number): string {
  return value
    .split(/\s+/)
    .map((part) => {
      const num = parseFloat(part);
      if (isNaN(num)) return part;
      const unit = part.replace(/^[\d.]+/, '');
      const scaled = (num * factor).toFixed(2).replace(/\.?0+$/, '');
      return `${scaled}${unit}`;
    })
    .join(' ');
}

function applyAutoScale(base: LabelFormat, custom: LabelFormat): LabelFormat {
  const factor = computeScaleFactor(base, custom);
  if (factor === 1) return custom;
  return {
    ...custom,
    nameFontSize: scaleValue(base.nameFontSize, factor),
    contentFontSize: scaleValue(base.contentFontSize, factor),
    codeFontSize: scaleValue(base.codeFontSize, factor),
    padding: scaleValue(base.padding, factor),
  };
}

const FONT_SCALE_PRESETS = [
  { label: 'S', value: 0.75 },
  { label: 'Default', value: 1 },
  { label: 'L', value: 1.25 },
  { label: 'XL', value: 1.5 },
];

function applyFontScale(fmt: LabelFormat, scale: number): LabelFormat {
  if (scale === 1) return fmt;
  return {
    ...fmt,
    nameFontSize: scaleValue(fmt.nameFontSize, scale),
    contentFontSize: scaleValue(fmt.contentFontSize, scale),
    codeFontSize: scaleValue(fmt.codeFontSize, scale),
  };
}

const CUSTOM_FIELDS: { label: string; key: keyof LabelFormat; min: string; max?: string; step: string; isNumber?: boolean }[] = [
  { label: 'Page Width (in)', key: 'pageWidth', min: '1', step: '0.5', isNumber: true },
  { label: 'Page Height (in)', key: 'pageHeight', min: '1', step: '0.5', isNumber: true },
  { label: 'Label Width (in)', key: 'cellWidth', min: '0.1', step: '0.0625' },
  { label: 'Label Height (in)', key: 'cellHeight', min: '0.1', step: '0.0625' },
  { label: 'Columns', key: 'columns', min: '1', max: '10', step: '1', isNumber: true },
  { label: 'QR Size (in)', key: 'qrSize', min: '0.1', step: '0.0625' },
  { label: 'Top Margin (in)', key: 'pageMarginTop', min: '0', step: '0.0625' },
  { label: 'Bottom Margin (in)', key: 'pageMarginBottom', min: '0', step: '0.0625' },
  { label: 'Left Margin (in)', key: 'pageMarginLeft', min: '0', step: '0.0625' },
  { label: 'Right Margin (in)', key: 'pageMarginRight', min: '0', step: '0.0625' },
];

export function PrintPage() {
  const [searchParams] = useSearchParams();
  const { bins: allBins, isLoading: binsLoading } = useBinList(undefined, 'name');
  const { activeLocationId } = useAuth();
  const t = useTerminology();
  const { areas } = useAreaList(activeLocationId);
  const { settings, isLoading: settingsLoading, updateFormatKey, updateCustomState, updateLabelOptions, addPreset, removePreset } = usePrintSettings();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [binsExpanded, setBinsExpanded] = useState(false);
  const [formatExpanded, setFormatExpanded] = useState(true);
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { formatKey, customState, labelOptions, presets: savedPresets } = settings;

  useEffect(() => {
    const idsParam = searchParams.get('ids');
    if (idsParam) {
      setSelectedIds(new Set(idsParam.split(',')));
    }
  }, [searchParams]);

  function handleFormatChange(key: string) {
    updateFormatKey(key);
    if (customState.customizing) {
      const newPreset = getLabelFormat(key, savedPresets);
      const newState: CustomState = { customizing: true, overrides: seedOverrides(newPreset) };
      updateCustomState(newState);
    }
  }

  function seedOverrides(fmt: LabelFormat): Partial<LabelFormat> {
    const { width, height } = computePageSize(fmt);
    return {
      pageWidth: fmt.pageWidth ?? width,
      pageHeight: fmt.pageHeight ?? height,
      cellWidth: fmt.cellWidth,
      cellHeight: fmt.cellHeight,
      columns: fmt.columns,
      qrSize: fmt.qrSize,
      pageMarginTop: fmt.pageMarginTop,
      pageMarginBottom: fmt.pageMarginBottom,
      pageMarginLeft: fmt.pageMarginLeft,
      pageMarginRight: fmt.pageMarginRight,
      orientation: getOrientation(fmt),
    };
  }

  function toggleCustomize() {
    const next = !customState.customizing;
    let newState: CustomState;
    if (next) {
      newState = { customizing: true, overrides: seedOverrides(getLabelFormat(formatKey, savedPresets)) };
    } else {
      newState = { customizing: false, overrides: {} };
    }
    updateCustomState(newState);
  }

  function updateOverride(key: keyof LabelFormat, raw: string) {
    const field = CUSTOM_FIELDS.find((f) => f.key === key);
    const value = field?.isNumber ? Number(raw) : `${raw}in`;
    const newState: CustomState = {
      ...customState,
      overrides: { ...customState.overrides, [key]: value },
    };
    updateCustomState(newState);
  }

  function getOverrideValue(key: keyof LabelFormat): string {
    const val = customState.overrides[key];
    if (val === undefined) return '';
    if (typeof val === 'number') return String(val);
    return String(val).replace(/in$/, '');
  }

  function handleSavePreset() {
    const name = presetName.trim();
    if (!name) return;
    const key = `custom-${Date.now()}`;
    const preset: LabelFormat = { ...labelFormat, key, name };
    addPreset(preset);
    updateFormatKey(key);
    updateCustomState({ customizing: false, overrides: {} });
    setPresetName('');
    setShowSaveInput(false);
  }

  function handleDeletePreset(key: string) {
    removePreset(key);
    if (formatKey === key) {
      updateFormatKey(DEFAULT_LABEL_FORMAT);
    }
  }

  const isLoading = binsLoading || settingsLoading;

  if (isLoading) {
    return (
      <div className="print-hide flex flex-col gap-4 px-5 pt-2 lg:pt-6 pb-2 max-w-2xl mx-auto">
        <Skeleton className="h-10 w-24" />
        <div className="glass-card rounded-[var(--radius-lg)] p-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3">
              <Skeleton className="h-[22px] w-[22px] rounded-full shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const baseFormat = getLabelFormat(formatKey, savedPresets);
  const mergedFormat = customState.customizing ? { ...baseFormat, ...customState.overrides } : baseFormat;
  const scaledFormat = customState.customizing ? applyAutoScale(baseFormat, mergedFormat) : mergedFormat;
  const labelFormat = applyFontScale(scaledFormat, labelOptions.fontScale);
  const iconSize = customState.customizing
    ? `${(11 * computeScaleFactor(baseFormat, mergedFormat)).toFixed(2).replace(/\.?0+$/, '')}pt`
    : '11pt';
  const effectiveOrientation = customState.overrides.orientation ?? getOrientation(baseFormat);
  const selectedBins: Bin[] = allBins.filter((b) => selectedIds.has(b.id));

  async function handleDownloadPDF() {
    if (pdfLoading || selectedBins.length === 0) return;
    setPdfLoading(true);
    try {
      const { downloadLabelPDF } = await import('./downloadLabelPDF');
      await downloadLabelPDF({ bins: selectedBins, format: labelFormat, labelOptions, iconSize });
    } finally {
      setPdfLoading(false);
    }
  }

  function toggleOrientation() {
    const newOrientation = effectiveOrientation === 'landscape' ? 'portrait' : 'landscape';
    const currentW = customState.overrides.cellWidth ?? baseFormat.cellWidth;
    const currentH = customState.overrides.cellHeight ?? baseFormat.cellHeight;
    const newState: CustomState = {
      ...customState,
      orientation: newOrientation,
      overrides: {
        ...customState.overrides,
        cellWidth: currentH,
        cellHeight: currentW,
        orientation: newOrientation,
      },
    };
    updateCustomState(newState);
  }

  function toggleBin(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(allBins.map((b) => b.id)));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  function selectByArea(areaId: string | null) {
    const ids = allBins.filter((b) => b.area_id === areaId).map((b) => b.id);
    setSelectedIds(new Set(ids));
  }

  function handleUpdateLabelOption<K extends keyof LabelOptions>(key: K, value: LabelOptions[K]) {
    const next = { ...labelOptions, [key]: value };
    updateLabelOptions(next);
  }

  return (
    <>
      <div className="print-hide flex flex-col gap-4 px-5 pt-2 lg:pt-6 pb-2 max-w-2xl mx-auto">
        <h1 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
          Print
        </h1>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between w-full">
              <button
                className="flex items-center gap-2 flex-1 min-w-0"
                onClick={() => setBinsExpanded((v) => !v)}
              >
                <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal pointer-events-none">Select {t.Bins}</Label>
                <span className="text-[13px] text-[var(--text-tertiary)]">({selectedIds.size} selected)</span>
                <ChevronDown className={cn(
                  'h-5 w-5 text-[var(--text-tertiary)] transition-transform duration-200',
                  binsExpanded && 'rotate-180'
                )} />
              </button>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="text-[13px] text-[var(--accent)] h-8 px-2.5"
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectNone}
                  className="text-[13px] text-[var(--accent)] h-8 px-2.5"
                >
                  None
                </Button>
              </div>
            </div>

            {binsExpanded && (
              <>
                {areas.length > 0 && allBins.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 mb-1">
                    {areas.map((area) => {
                      const count = allBins.filter((b) => b.area_id === area.id).length;
                      if (count === 0) return null;
                      return (
                        <button
                          key={area.id}
                          type="button"
                          onClick={() => selectByArea(area.id)}
                          className="inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-1 text-[12px] font-medium bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-active)] transition-colors"
                        >
                          {area.name}
                          <span className="ml-1 text-[var(--text-tertiary)]">({count})</span>
                        </button>
                      );
                    })}
                    {allBins.some((b) => !b.area_id) && (
                      <button
                        type="button"
                        onClick={() => selectByArea(null)}
                        className="inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-1 text-[12px] font-medium bg-[var(--bg-input)] text-[var(--text-tertiary)] hover:bg-[var(--bg-active)] transition-colors italic"
                      >
                        Unassigned
                        <span className="ml-1">({allBins.filter((b) => !b.area_id).length})</span>
                      </button>
                    )}
                  </div>
                )}
                {allBins.length === 0 ? (
                  <p className="text-[13px] text-[var(--text-tertiary)] py-8 text-center">
                    No {t.bins} to print. Create some {t.bins} first.
                  </p>
                ) : (
                  <div className="space-y-0.5 max-h-80 overflow-y-auto -mx-2">
                    {allBins.map((bin) => {
                      const checked = selectedIds.has(bin.id);
                      return (
                        <button
                          key={bin.id}
                          className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 w-full text-left hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)] transition-colors"
                          onClick={() => toggleBin(bin.id)}
                        >
                          {checked ? (
                            <CheckCircle2 className="h-[22px] w-[22px] text-[var(--accent)] shrink-0" />
                          ) : (
                            <Circle className="h-[22px] w-[22px] text-[var(--text-tertiary)] shrink-0" />
                          )}
                          <span className="text-[15px] text-[var(--text-primary)] truncate">{bin.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Label Format */}
        <Card>
          <CardContent>
            <button
              className="flex items-center justify-between w-full"
              onClick={() => setFormatExpanded((v) => !v)}
            >
              <div className="flex items-center gap-2">
                <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal pointer-events-none">Label Format</Label>
                {!formatExpanded && (
                  <span className="text-[13px] text-[var(--text-tertiary)]">({baseFormat.name})</span>
                )}
              </div>
              <ChevronDown className={cn(
                'h-5 w-5 text-[var(--text-tertiary)] transition-transform duration-200',
                formatExpanded && 'rotate-180'
              )} />
            </button>

            {formatExpanded && (
              <>
                <div className="space-y-1 mt-3">
                  {LABEL_FORMATS.map((fmt) => (
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
                          {fmt.columns > 1 ? `${computeLabelsPerPage(fmt)} per page` : 'single label'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

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
                              {fmt.cellWidth} × {fmt.cellHeight}
                            </span>
                          </div>
                        </button>
                        <button
                          className="shrink-0 p-2 mr-1 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--destructive)] hover:bg-[var(--bg-hover)] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          onClick={() => handleDeletePreset(fmt.key)}
                          aria-label={`Delete ${fmt.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

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
                      <span className="text-[12px] text-[var(--text-secondary)] font-medium mr-2">Orientation</span>
                      <div className="flex rounded-[var(--radius-sm)] border border-[var(--border-subtle)] overflow-hidden">
                        <button
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-[13px] transition-colors',
                            effectiveOrientation === 'landscape'
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                          )}
                          onClick={() => effectiveOrientation !== 'landscape' && toggleOrientation()}
                        >
                          <RectangleHorizontal className="h-3.5 w-3.5" />
                          Landscape
                        </button>
                        <button
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-[13px] transition-colors border-l border-[var(--border-subtle)]',
                            effectiveOrientation === 'portrait'
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                          )}
                          onClick={() => effectiveOrientation !== 'portrait' && toggleOrientation()}
                        >
                          <RectangleVertical className="h-3.5 w-3.5" />
                          Portrait
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3 px-1">
                      {CUSTOM_FIELDS.map((field) => (
                        <div key={field.key} className="flex flex-col gap-1">
                          <label className="text-[12px] text-[var(--text-secondary)] font-medium">
                            {field.label}
                          </label>
                          <input
                            type="number"
                            step={field.step}
                            min={field.min}
                            max={field.max}
                            value={getOverrideValue(field.key)}
                            onChange={(e) => updateOverride(field.key, e.target.value)}
                            className="h-9 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
                          />
                        </div>
                      ))}
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

        {/* Label Options */}
        <Card>
          <CardContent>
            <button
              className="flex items-center justify-between w-full"
              onClick={() => setOptionsExpanded((v) => !v)}
            >
              <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal pointer-events-none">Label Options</Label>
              <ChevronDown className={cn(
                'h-5 w-5 text-[var(--text-tertiary)] transition-transform duration-200',
                optionsExpanded && 'rotate-180'
              )} />
            </button>

            {optionsExpanded && (
              <div className="mt-3 space-y-4">
                <div className="px-1">
                  <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-2">Font Size</span>
                  <div className="flex rounded-[var(--radius-sm)] border border-[var(--border-subtle)] overflow-hidden">
                    {FONT_SCALE_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        className={cn(
                          'flex-1 px-3 py-1.5 text-[13px] transition-colors',
                          preset.value !== FONT_SCALE_PRESETS[0].value && 'border-l border-[var(--border-subtle)]',
                          labelOptions.fontScale === preset.value
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                        )}
                        onClick={() => handleUpdateLabelOption('fontScale', preset.value)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1 px-1">
                  <span className="text-[12px] text-[var(--text-secondary)] font-medium block mb-1">Visible Elements</span>
                  {([
                    { key: 'showQrCode' as const, label: 'QR Code' },
                    { key: 'showBinName' as const, label: `${t.Bin} Name` },
                    { key: 'showIcon' as const, label: `${t.Bin} Icon` },
                    { key: 'showLocation' as const, label: t.Area },
                    { key: 'showBinCode' as const, label: `${t.Bin} Code` },
                    { key: 'showColorSwatch' as const, label: 'Color Swatch' },
                  ]).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 px-2 py-1.5 cursor-pointer rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] transition-colors">
                      <Checkbox
                        checked={labelOptions[key]}
                        onCheckedChange={(checked) => handleUpdateLabelOption(key, !!checked)}
                      />
                      <span className="text-[15px] text-[var(--text-primary)]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedBins.length > 0 && (
          <>
            <div className="flex gap-2">
              <Button
                onClick={() => window.print()}
                className="flex-1 rounded-[var(--radius-md)] h-12 text-[17px]"
              >
                <Printer className="h-5 w-5 mr-2.5" />
                Print {selectedBins.length} {selectedBins.length !== 1 ? 'Labels' : 'Label'}
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadPDF}
                disabled={pdfLoading}
                className="rounded-[var(--radius-md)] h-12 px-4 text-[15px]"
              >
                <Download className={cn('h-5 w-5 mr-1.5', pdfLoading && 'animate-pulse')} />
                PDF
              </Button>
            </div>

            <Card>
              <CardContent>
                <Label className="text-[15px] font-semibold text-[var(--text-primary)] normal-case tracking-normal mb-3 block">Preview</Label>
                <div className="bg-white rounded-[var(--radius-md)] p-4 overflow-auto dark:border dark:border-[var(--border-subtle)]">
                  <LabelSheet bins={selectedBins} format={labelFormat} showColorSwatch={labelOptions.showColorSwatch} iconSize={iconSize} showQrCode={labelOptions.showQrCode} showBinName={labelOptions.showBinName} showIcon={labelOptions.showIcon} showLocation={labelOptions.showLocation} showBinCode={labelOptions.showBinCode} />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="print-show">
        <LabelSheet bins={selectedBins} format={labelFormat} showColorSwatch={labelOptions.showColorSwatch} iconSize={iconSize} showQrCode={labelOptions.showQrCode} showBinName={labelOptions.showBinName} showIcon={labelOptions.showIcon} showLocation={labelOptions.showLocation} showBinCode={labelOptions.showBinCode} />
      </div>
    </>
  );
}
