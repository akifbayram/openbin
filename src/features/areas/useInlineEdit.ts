import { useState } from 'react';

interface UseInlineEditOptions {
  currentName: string;
  onSave: (newName: string) => Promise<void>;
}

export function useInlineEdit({ currentName, onSave }: UseInlineEditOptions) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setEditValue(currentName);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function handleSave() {
    if (!editValue.trim() || editValue.trim() === currentName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(editValue.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { cancelEdit(); }
  }

  return { editing, editValue, saving, startEdit, cancelEdit, setEditValue, handleSave, handleKeyDown };
}
