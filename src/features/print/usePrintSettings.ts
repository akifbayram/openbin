import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { LabelFormat } from './labelFormats';

export interface LabelOptions {
  fontScale: number;
  textAlign: 'left' | 'center';
  showQrCode: boolean;
  showBinName: boolean;
  showIcon: boolean;
  showLocation: boolean;
  showBinCode: boolean;
  showColorSwatch: boolean;
}

export interface CustomState {
  customizing: boolean;
  overrides: Partial<LabelFormat>;
}

export type DisplayUnit = 'in' | 'mm';

export interface PrintSettings {
  formatKey: string;
  customState: CustomState;
  labelOptions: LabelOptions;
  presets: LabelFormat[];
  orientation?: 'landscape' | 'portrait';
  displayUnit?: DisplayUnit;
}

export const DEFAULT_LABEL_OPTIONS: LabelOptions = {
  fontScale: 1,
  textAlign: 'center',
  showQrCode: true,
  showBinName: true,
  showIcon: true,
  showLocation: false,
  showBinCode: true,
  showColorSwatch: false,
};

const DEFAULT_CUSTOM_STATE: CustomState = { customizing: false, overrides: {} };

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  formatKey: 'avery-5160',
  customState: DEFAULT_CUSTOM_STATE,
  labelOptions: DEFAULT_LABEL_OPTIONS,
  presets: [],
};

export async function savePrintSettings(settings: PrintSettings): Promise<void> {
  await apiFetch('/api/print-settings', { method: 'PUT', body: settings });
}

export function usePrintSettings() {
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const latestRef = useRef<PrintSettings>(settings);

  // Keep ref in sync
  latestRef.current = settings;

  const debouncedSave = useCallback((next: PrintSettings) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      savePrintSettings(next).catch((err) => console.error('Failed to save print settings:', err));
    }, 500);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await apiFetch<PrintSettings | null>('/api/print-settings');
        if (cancelled) return;
        if (data) {
          setSettings({ ...DEFAULT_PRINT_SETTINGS, ...data });
        }
      } catch {
        // Network or server error — keep defaults
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    function onChanged() {
      apiFetch<PrintSettings>('/api/print-settings')
        .then((data) => { if (!cancelled) setSettings({ ...DEFAULT_PRINT_SETTINGS, ...data }); })
        .catch(() => {});
    }

    window.addEventListener('print-settings-changed', onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('print-settings-changed', onChanged);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  function update(partial: Partial<PrintSettings>) {
    const next = { ...latestRef.current, ...partial };
    latestRef.current = next;
    setSettings(next);
    debouncedSave(next);
  }

  function updateFormatKey(formatKey: string) {
    update({ formatKey });
  }

  function updateCustomState(customState: CustomState) {
    update({ customState });
  }

  function updateLabelOptions(labelOptions: LabelOptions) {
    update({ labelOptions });
  }

  function addPreset(preset: LabelFormat) {
    const next = [...latestRef.current.presets, preset];
    update({ presets: next });
  }

  function removePreset(key: string) {
    const next = latestRef.current.presets.filter((p) => p.key !== key);
    update({ presets: next });
  }

  function updateOrientation(orientation: 'landscape' | 'portrait' | undefined) {
    update({ orientation });
  }

  function updateDisplayUnit(displayUnit: DisplayUnit) {
    update({ displayUnit });
  }

  return {
    settings,
    isLoading,
    updateFormatKey,
    updateCustomState,
    updateLabelOptions,
    updateOrientation,
    updateDisplayUnit,
    addPreset,
    removePreset,
  };
}
