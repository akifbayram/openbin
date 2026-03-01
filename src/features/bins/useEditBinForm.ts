import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import type { Bin, BinVisibility } from '@/types';
import { useBinFormFields } from './useBinFormFields';
import { updateBin } from './useBins';

interface OriginalSnapshot {
  name: string;
  areaId: string | null;
  items: string[];
  notes: string;
  tags: string[];
  icon: string;
  color: string;
  cardStyle: string;
  visibility: BinVisibility;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

export function useEditBinForm(id: string | undefined) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
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
  } = useBinFormFields();
  const originalRef = useRef<OriginalSnapshot | null>(null);

  const isDirty = useMemo(() => {
    if (!editing || !originalRef.current) return false;
    const o = originalRef.current;
    return (
      name !== o.name ||
      areaId !== o.areaId ||
      !arraysEqual(items, o.items) ||
      notes !== o.notes ||
      !arraysEqual(tags, o.tags) ||
      icon !== o.icon ||
      color !== o.color ||
      cardStyle !== o.cardStyle ||
      visibility !== o.visibility
    );
  }, [editing, name, areaId, items, notes, tags, icon, color, cardStyle, visibility]);

  // beforeunload warning when dirty
  useEffect(() => {
    if (!editing || !isDirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [editing, isDirty]);

  function startEdit(bin: Bin) {
    const itemNames = bin.items.map((i) => i.name);
    setName(bin.name);
    setAreaId(bin.area_id);
    setItems(itemNames);
    setNotes(bin.notes);
    setTags([...bin.tags]);
    setIcon(bin.icon);
    setColor(bin.color);
    setCardStyle(bin.card_style);
    setVisibility(bin.visibility);
    originalRef.current = {
      name: bin.name,
      areaId: bin.area_id,
      items: itemNames,
      notes: bin.notes,
      tags: [...bin.tags],
      icon: bin.icon,
      color: bin.color,
      cardStyle: bin.card_style,
      visibility: bin.visibility,
    };
    setEditing(true);
  }

  async function saveEdit() {
    if (!id || !name.trim()) return;
    try {
      await updateBin(id, {
        name: name.trim(),
        areaId,
        items,
        notes: notes.trim(),
        tags,
        icon,
        color,
        cardStyle,
        visibility,
      });
      setEditing(false);
      originalRef.current = null;
    } catch {
      showToast({ message: 'Failed to save changes' });
    }
  }

  function cancelEdit() {
    setEditing(false);
    originalRef.current = null;
  }

  return {
    editing,
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
    startEdit,
    saveEdit,
    cancelEdit,
  };
}
