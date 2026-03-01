import { useState } from 'react';
import { useAreaList } from '@/features/areas/useAreas';
import { useBinList } from '@/features/bins/useBins';
import { useAuth } from '@/lib/auth';
import { computeEffectiveFormat } from './computeEffectiveFormat';
import type { LabelFormat } from './labelFormats';
import { applyOrientation, computePageSize, DEFAULT_LABEL_FORMAT, getLabelFormat, getOrientation } from './labelFormats';
import { inchesToMm, mmToInches } from './pdfUnits';
import { useBinSelection } from './useBinSelection';
import type { CustomState, DisplayUnit, LabelOptions, QrStyleOptions } from './usePrintSettings';
import { DEFAULT_QR_STYLE, usePrintSettings } from './usePrintSettings';

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

export interface SelectionState {
  selectedIds: Set<string>;
  selectedBins: import('@/types').Bin[];
  toggleBin: (id: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  selectByArea: (areaId: string | null) => void;
}

export interface FormatState {
  formatKey: string;
  baseFormat: LabelFormat;
  effectiveOrientation: 'landscape' | 'portrait';
  customState: CustomState;
  displayUnit: DisplayUnit;
  savedPresets: LabelFormat[];
  labelFormat: LabelFormat;
  iconSize: string;
  handleFormatChange: (key: string) => void;
  toggleCustomize: () => void;
  updateOverride: (key: keyof LabelFormat, raw: string) => void;
  getOverrideValue: (key: keyof LabelFormat) => string;
  toggleOrientation: () => void;
  updateDisplayUnit: (unit: DisplayUnit) => void;
  handleSavePreset: (name: string) => void;
  handleDeletePreset: (key: string) => void;
}

export function usePrintPageActions() {
  const { bins: allBins, isLoading: binsLoading } = useBinList(undefined, 'name');
  const { activeLocationId } = useAuth();
  const { areas } = useAreaList(activeLocationId);
  const { settings, isLoading: settingsLoading, updateFormatKey, updateCustomState, updateLabelOptions, updateOrientation, updateDisplayUnit, updateQrStyle, addPreset, removePreset } = usePrintSettings();
  const selection = useBinSelection(allBins);

  const [binsExpanded, setBinsExpanded] = useState(false);
  const [formatExpanded, setFormatExpanded] = useState(true);
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const [qrStyleExpanded, setQrStyleExpanded] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { formatKey, customState, labelOptions, presets: savedPresets, qrStyle: savedQrStyle } = settings;
  const qrStyle = savedQrStyle ?? DEFAULT_QR_STYLE;
  const displayUnit: DisplayUnit = settings.displayUnit ?? 'in';

  const { baseFormat, orientedBase, labelFormat, iconSize, effectiveOrientation } = computeEffectiveFormat(
    formatKey, settings.orientation, customState, labelOptions.fontScale, savedPresets,
  );

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
      updateCustomState({ customizing: true, overrides: seedOverrides(oriented) });
    }
  }

  function toggleCustomize() {
    if (!customState.customizing) {
      updateCustomState({ customizing: true, overrides: seedOverrides(orientedBase) });
    } else {
      updateCustomState({ customizing: false, overrides: {} });
    }
  }

  function updateOverride(key: keyof LabelFormat, raw: string) {
    if (!raw.trim()) return;
    const num = parseFloat(raw);
    if (Number.isNaN(num)) return;
    const field = CUSTOM_FIELDS.find((f) => f.key === key);
    const inValue = (displayUnit === 'mm' && field?.isDimensional) ? mmToInches(num) : num;
    const clamped = Math.max(field?.minIn ?? 0, inValue);
    const value = field?.isNumber ? clamped : `${clamped}in`;
    updateCustomState({ ...customState, overrides: { ...customState.overrides, [key]: value } });
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

  function handleSavePreset(name: string) {
    if (!name.trim()) return;
    const key = `custom-${Date.now()}`;
    const preset: LabelFormat = { ...labelFormat, key, name: name.trim() };
    addPreset(preset);
    updateFormatKey(key);
    updateCustomState({ customizing: false, overrides: {} });
  }

  function handleDeletePreset(key: string) {
    removePreset(key);
    if (formatKey === key) {
      updateFormatKey(DEFAULT_LABEL_FORMAT);
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

  function handleUpdateLabelOption<K extends keyof LabelOptions>(key: K, value: LabelOptions[K]) {
    updateLabelOptions({ ...labelOptions, [key]: value });
  }

  function handleUpdateQrStyle(style: QrStyleOptions) {
    updateQrStyle(style);
  }

  const isLoading = binsLoading || settingsLoading;

  const format: FormatState = {
    formatKey, baseFormat, effectiveOrientation, customState, displayUnit, savedPresets,
    labelFormat, iconSize,
    handleFormatChange, toggleCustomize, updateOverride, getOverrideValue,
    toggleOrientation, updateDisplayUnit,
    handleSavePreset, handleDeletePreset,
  };

  const labelSheetProps = {
    bins: selection.selectedBins,
    format: labelFormat,
    labelDirection: labelOptions.labelDirection,
    showColorSwatch: labelOptions.showColorSwatch,
    iconSize,
    showQrCode: labelOptions.showQrCode,
    showBinName: labelOptions.showBinName,
    showIcon: labelOptions.showIcon,
    showBinCode: labelOptions.showBinCode,
    textAlign: labelOptions.textAlign,
    qrStyle,
  };

  async function handleDownloadPDF() {
    if (pdfLoading || selection.selectedBins.length === 0) return;
    setPdfLoading(true);
    try {
      const { downloadLabelPDF } = await import('./downloadLabelPDF');
      await downloadLabelPDF({ bins: selection.selectedBins, format: labelFormat, labelOptions, iconSize, qrStyle });
    } finally {
      setPdfLoading(false);
    }
  }

  return {
    allBins,
    areas,
    isLoading,
    selection,
    format,
    labelOptions,
    handleUpdateLabelOption,
    qrStyle,
    handleUpdateQrStyle,
    ui: { binsExpanded, setBinsExpanded, formatExpanded, setFormatExpanded, optionsExpanded, setOptionsExpanded, qrStyleExpanded, setQrStyleExpanded },
    pdfLoading,
    handleDownloadPDF,
    labelSheetProps,
  };
}
