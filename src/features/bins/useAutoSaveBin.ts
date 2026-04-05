import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import type { Bin, BinVisibility } from '@/types';
import { updateBin } from './useBins';

type FieldName = 'name' | 'notes' | 'tags' | 'areaId' | 'icon' | 'color' | 'cardStyle' | 'visibility' | 'customFields';

export function useAutoSaveBin(bin: Bin | null) {
  const { showToast } = useToast();
  const [savedFields, setSavedFields] = useState<Set<FieldName>>(new Set());
  const [savingFields, setSavingFields] = useState<Set<FieldName>>(new Set());

  const debounceTimers = useRef<Map<FieldName, ReturnType<typeof setTimeout>>>(new Map());
  const savedTimers = useRef<Map<FieldName, ReturnType<typeof setTimeout>>>(new Map());
  const pendingSaves = useRef<Map<FieldName, Record<string, unknown>>>(new Map());
  const binRef = useRef(bin);
  binRef.current = bin;

  // Single cleanup effect — flush pending debounced saves, clear all timers
  useEffect(() => {
    const dTimers = debounceTimers;
    const sTimers = savedTimers;
    const pending = pendingSaves;
    return () => {
      for (const t of sTimers.current.values()) clearTimeout(t);
      for (const [field, timer] of dTimers.current) {
        clearTimeout(timer);
        const changes = pending.current.get(field);
        if (changes && binRef.current) {
          updateBin(binRef.current.id, changes).catch(() => {});
        }
      }
      dTimers.current.clear();
      pending.current.clear();
    };
  }, []);

  function markSaved(field: FieldName) {
    setSavedFields((prev) => new Set(prev).add(field));
    const existing = savedTimers.current.get(field);
    if (existing) clearTimeout(existing);
    savedTimers.current.set(field, setTimeout(() => {
      setSavedFields((prev) => { const next = new Set(prev); next.delete(field); return next; });
      savedTimers.current.delete(field);
    }, 600));
  }

  async function doSave(field: FieldName, changes: Record<string, unknown>) {
    if (!binRef.current) return;
    setSavingFields((prev) => new Set(prev).add(field));
    try {
      await updateBin(binRef.current.id, changes);
      markSaved(field);
    } catch {
      showToast({ message: `Failed to save ${field === 'areaId' ? 'area' : field === 'cardStyle' ? 'style' : field}` });
    } finally {
      setSavingFields((prev) => { const next = new Set(prev); next.delete(field); return next; });
    }
  }

  function debouncedSave(field: FieldName, changes: Record<string, unknown>, delay: number) {
    pendingSaves.current.set(field, changes);
    const existing = debounceTimers.current.get(field);
    if (existing) clearTimeout(existing);
    debounceTimers.current.set(field, setTimeout(() => {
      debounceTimers.current.delete(field);
      pendingSaves.current.delete(field);
      doSave(field, changes);
    }, delay));
  }

  const saveName = useCallback((name: string) => {
    if (!binRef.current || name.trim() === binRef.current.name) return;
    debouncedSave('name', { name: name.trim() }, 300);
  }, []);

  const saveNotes = useCallback((notes: string) => {
    if (!binRef.current || notes === binRef.current.notes) return;
    debouncedSave('notes', { notes }, 300);
  }, []);

  const saveTags = useCallback((tags: string[]) => {
    doSave('tags', { tags });
  }, []);

  const saveAreaId = useCallback((areaId: string | null) => {
    doSave('areaId', { areaId });
  }, []);

  const saveIcon = useCallback((icon: string) => {
    doSave('icon', { icon });
  }, []);

  const saveColor = useCallback((color: string) => {
    if (!binRef.current || color === binRef.current.color) return;
    debouncedSave('color', { color }, 200);
  }, []);

  const saveCardStyle = useCallback((cardStyle: string) => {
    if (!binRef.current || cardStyle === binRef.current.card_style) return;
    debouncedSave('cardStyle', { cardStyle }, 200);
  }, []);

  const saveVisibility = useCallback((visibility: BinVisibility) => {
    doSave('visibility', { visibility });
  }, []);

  const saveCustomFields = useCallback((customFields: Record<string, string>) => {
    doSave('customFields', { customFields });
  }, []);

  return {
    saveName, saveNotes, saveTags, saveAreaId, saveIcon,
    saveColor, saveCardStyle, saveVisibility, saveCustomFields,
    savedFields, savingFields,
  };
}
