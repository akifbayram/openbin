import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBinList } from '@/features/bins/useBins';
import { useAreaList } from '@/features/areas/useAreas';
import { useAuth } from '@/lib/auth';
import { getLabelFormat, DEFAULT_LABEL_FORMAT, getOrientation, applyOrientation, computePageSize } from './labelFormats';
import { usePrintSettings } from './usePrintSettings';
import type { LabelFormat } from './labelFormats';
import type { LabelOptions, CustomState, DisplayUnit } from './usePrintSettings';
import { inchesToMm, mmToInches } from './pdfUnits';
import { computeScaleFactor, applyAutoScale, applyFontScale } from './labelScaling';
import type { Bin } from '@/types';

const CUSTOM_FIELDS: { label: string; key: keyof LabelFormat; minIn: number; max?: string; stepIn: string; stepMm: string; isNumber?: boolean; isDimensional: boolean }[] = [
  { label: 'Page Width', key: 'pageWidth', minIn: 1, stepIn: '0.5', stepMm: '10', isNumber: true, isDimensional: true },
  { label: 'Page Height', key: 'pageHeight', minIn: 1, stepIn: '0.5', stepMm: '10', isNumber: true, isDimensional: true },
  { label: 'Label Width', key: 'cellWidth', minIn: 0.1, stepIn: '0.0625', stepMm: '1', isDimensional: true },
  { label: 'Label Height', key: 'cellHeight', minIn: 0.1, stepIn: '0.0625', stepMm: '1', isDimensional: true },
  { label: 'Columns', key: 'columns', minIn: 1, max: '10', stepIn: '1', stepMm: '1', isNumber: true, isDimensional: false },
  { label: 'QR Size', key: 'qrSize', minIn: 0.1, stepIn: '0.0625', stepMm: '1', isDimensional: true },
  { label: 'Top Margin', key: 'pageMarginTop', minIn: 0, stepIn: '0.0625', stepMm: '1', isDimensional: true },
  { label: 'Bottom Margin', key: 'pageMarginBottom', minIn: 0, stepIn: '0.0625', stepMm: '1', isDimensional: true },
  { label: 'Left Margin', key: 'pageMarginLeft', minIn: 0, stepIn: '0.0625', stepMm: '1', isDimensional: true },
  { label: 'Right Margin', key: 'pageMarginRight', minIn: 0, stepIn: '0.0625', stepMm: '1', isDimensional: true },
];

export { CUSTOM_FIELDS };

export function usePrintPageActions() {
  const [searchParams] = useSearchParams();
  const { bins: allBins, isLoading: binsLoading } = useBinList(undefined, 'name');
  const { activeLocationId } = useAuth();
  const { areas } = useAreaList(activeLocationId);
  const { settings, isLoading: settingsLoading, updateFormatKey, updateCustomState, updateLabelOptions, updateOrientation, updateDisplayUnit, addPreset, removePreset } = usePrintSettings();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [binsExpanded, setBinsExpanded] = useState(false);
  const [formatExpanded, setFormatExpanded] = useState(true);
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [formatSearch, setFormatSearch] = useState('');

  const { formatKey, customState, labelOptions, presets: savedPresets } = settings;

  useEffect(() => {
    const idsParam = searchParams.get('ids');
    if (idsParam) {
      setSelectedIds(new Set(idsParam.split(',')));
    }
  }, [searchParams]);

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
    };
  }

  function handleFormatChange(key: string) {
    updateFormatKey(key);
    if (customState.customizing) {
      const newBase = getLabelFormat(key, savedPresets);
      const oriented = applyOrientation(newBase, settings.orientation);
      const newState: CustomState = { customizing: true, overrides: seedOverrides(oriented) };
      updateCustomState(newState);
    }
  }

  function toggleCustomize() {
    const next = !customState.customizing;
    let newState: CustomState;
    if (next) {
      const oriented = applyOrientation(getLabelFormat(formatKey, savedPresets), settings.orientation);
      newState = { customizing: true, overrides: seedOverrides(oriented) };
    } else {
      newState = { customizing: false, overrides: {} };
    }
    updateCustomState(newState);
  }

  const displayUnit: DisplayUnit = settings.displayUnit ?? 'in';

  function updateOverride(key: keyof LabelFormat, raw: string) {
    if (!raw.trim()) return;
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    const field = CUSTOM_FIELDS.find((f) => f.key === key);
    const inValue = (displayUnit === 'mm' && field?.isDimensional) ? mmToInches(num) : num;
    const clamped = Math.max(field?.minIn ?? 0, inValue);
    const value = field?.isNumber ? clamped : `${clamped}in`;
    const newState: CustomState = {
      ...customState,
      overrides: { ...customState.overrides, [key]: value },
    };
    updateCustomState(newState);
  }

  function getOverrideValue(key: keyof LabelFormat): string {
    const val = customState.overrides[key];
    if (val === undefined) return '';
    const field = CUSTOM_FIELDS.find((f) => f.key === key);
    const inValue = typeof val === 'number' ? val : parseFloat(String(val).replace(/in$/, ''));
    if (displayUnit === 'mm' && field?.isDimensional) {
      return String(inchesToMm(inValue));
    }
    return String(inValue);
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

  const baseFormat = getLabelFormat(formatKey, savedPresets);
  const orientedBase = applyOrientation(baseFormat, settings.orientation);
  const customFormat = customState.customizing ? { ...orientedBase, ...customState.overrides } : orientedBase;
  const scaledFormat = customState.customizing ? applyAutoScale(orientedBase, customFormat) : customFormat;
  const labelFormat = applyFontScale(scaledFormat, labelOptions.fontScale);
  const iconSize = customState.customizing
    ? `${(11 * computeScaleFactor(orientedBase, customFormat)).toFixed(2).replace(/\.?0+$/, '')}pt`
    : '11pt';
  const effectiveOrientation = settings.orientation ?? getOrientation(baseFormat);
  const selectedBins: Bin[] = allBins.filter((b) => selectedIds.has(b.id));

  const labelSheetProps = {
    bins: selectedBins,
    format: labelFormat,
    showColorSwatch: labelOptions.showColorSwatch,
    iconSize,
    showQrCode: labelOptions.showQrCode,
    showBinName: labelOptions.showBinName,
    showIcon: labelOptions.showIcon,
    showLocation: labelOptions.showLocation,
    showBinCode: labelOptions.showBinCode,
    textAlign: labelOptions.textAlign,
  };

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
    const next = effectiveOrientation === 'landscape' ? 'portrait' : 'landscape';
    const value = next === getOrientation(baseFormat) ? undefined : next;
    updateOrientation(value);
    if (customState.customizing) {
      const oriented = applyOrientation(baseFormat, value);
      updateCustomState({ customizing: true, overrides: seedOverrides(oriented) });
    }
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

  return {
    // Data
    allBins,
    areas,
    isLoading,
    // Selection
    selectedIds,
    selectedBins,
    toggleBin,
    selectAll,
    selectNone,
    selectByArea,
    // Format
    formatKey,
    baseFormat,
    labelFormat,
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
    // Presets
    presetName,
    setPresetName,
    showSaveInput,
    setShowSaveInput,
    handleSavePreset,
    handleDeletePreset,
    // Options
    labelOptions,
    handleUpdateLabelOption,
    // UI expand state
    binsExpanded,
    setBinsExpanded,
    formatExpanded,
    setFormatExpanded,
    optionsExpanded,
    setOptionsExpanded,
    // PDF / print
    pdfLoading,
    handleDownloadPDF,
    labelSheetProps,
    iconSize,
  };
}
