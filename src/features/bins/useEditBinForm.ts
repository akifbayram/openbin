import { useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useWarnOnUnload } from '@/lib/useWarnOnUnload';
import type { Bin, BinItem, BinVisibility } from '@/types';
import { useBinFormFields } from './useBinFormFields';
import { updateBin } from './useBins';

interface OriginalSnapshot {
  name: string;
  areaId: string | null;
  items: BinItem[];
  notes: string;
  tags: string[];
  icon: string;
  color: string;
  cardStyle: string;
  visibility: BinVisibility;
  customFields: Record<string, string>;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

function binItemsEqual(a: BinItem[], b: BinItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.name === b[i].name && item.quantity === b[i].quantity);
}

function recordsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((k) => a[k] === b[k]);
}

export function useEditBinForm(id: string | undefined) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const {
    name, setName,
    areaId, setAreaId,
    items, setItems,
    notes, setNotes,
    tags, setTags,
    icon, setIcon,
    color, setColor,
    cardStyle, setCardStyle,
    visibility, setVisibility,
    customFields, setCustomFields,
  } = useBinFormFields();
  const originalRef = useRef<OriginalSnapshot | null>(null);

  const isDirty = useMemo(() => {
    if (!editing || !originalRef.current) return false;
    const o = originalRef.current;
    return (
      name !== o.name ||
      areaId !== o.areaId ||
      !binItemsEqual(items, o.items) ||
      notes !== o.notes ||
      !arraysEqual(tags, o.tags) ||
      icon !== o.icon ||
      color !== o.color ||
      cardStyle !== o.cardStyle ||
      visibility !== o.visibility ||
      !recordsEqual(customFields, o.customFields)
    );
  }, [editing, name, areaId, items, notes, tags, icon, color, cardStyle, visibility, customFields]);

  useWarnOnUnload(editing && isDirty);

  function startEdit(bin: Bin) {
    setName(bin.name);
    setAreaId(bin.area_id);
    setItems(bin.items.map((i) => ({ ...i })));
    setNotes(bin.notes);
    setTags([...bin.tags]);
    setIcon(bin.icon);
    setColor(bin.color);
    setCardStyle(bin.card_style);
    setVisibility(bin.visibility);
    setCustomFields(bin.custom_fields || {});
    originalRef.current = {
      name: bin.name,
      areaId: bin.area_id,
      items: bin.items.map((i) => ({ ...i })),
      notes: bin.notes,
      tags: [...bin.tags],
      icon: bin.icon,
      color: bin.color,
      cardStyle: bin.card_style,
      visibility: bin.visibility,
      customFields: { ...(bin.custom_fields || {}) },
    };
    setEditing(true);
  }

  async function saveEdit() {
    if (!id || !name.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await updateBin(id, {
        name: name.trim(),
        areaId,
        items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
        notes: notes.trim(),
        tags,
        icon,
        color,
        cardStyle,
        visibility,
        customFields,
      });
      setEditing(false);
      originalRef.current = null;
      showToast({ message: 'Changes saved', variant: 'success' });
    } catch {
      showToast({ message: 'Failed to save changes' });
    } finally {
      setIsSaving(false);
    }
  }

  function cancelEdit() {
    setEditing(false);
    originalRef.current = null;
  }

  return {
    editing,
    isSaving,
    isDirty,
    name, setName,
    areaId, setAreaId,
    items, setItems,
    notes, setNotes,
    tags, setTags,
    icon, setIcon,
    color, setColor,
    cardStyle, setCardStyle,
    visibility, setVisibility,
    customFields, setCustomFields,
    startEdit,
    saveEdit,
    cancelEdit,
  };
}
