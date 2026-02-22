import { useState } from 'react';
import { updateBin } from './useBins';
import { useToast } from '@/components/ui/toast';
import type { Bin, BinVisibility } from '@/types';

export function useEditBinForm(id: string | undefined) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');
  const [cardStyle, setCardStyle] = useState('');
  const [visibility, setVisibility] = useState<BinVisibility>('location');

  function startEdit(bin: Bin) {
    setName(bin.name);
    setAreaId(bin.area_id);
    setItems(bin.items.map((i) => i.name));
    setNotes(bin.notes);
    setTags([...bin.tags]);
    setIcon(bin.icon);
    setColor(bin.color);
    setCardStyle(bin.card_style);
    setVisibility(bin.visibility);
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
    } catch {
      showToast({ message: 'Failed to save changes' });
    }
  }

  function cancelEdit() {
    setEditing(false);
  }

  return {
    editing,
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
