import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useTextStructuring } from '@/features/ai/useTextStructuring';
import { addItemsToBin } from './useBins';

type QuickAddState = 'input' | 'expanded' | 'processing' | 'preview';

interface UseQuickAddOptions {
  binId: string | undefined;
  binName: string;
  existingItems: string[];
  activeLocationId: string | undefined;
  aiConfigured: boolean;
  onNavigateAiSetup: () => void;
}

export function useQuickAdd(options: UseQuickAddOptions) {
  const { binId, binName, existingItems, activeLocationId, aiConfigured, onNavigateAiSetup } = options;
  const { showToast } = useToast();

  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<QuickAddState>('input');
  const [expandedText, setExpandedText] = useState('');
  const [checked, setChecked] = useState<Map<number, boolean>>(new Map());

  const {
    structuredItems,
    isStructuring,
    error: structureError,
    structure,
    clearStructured,
  } = useTextStructuring();

  function reset() {
    setState('input');
    setExpandedText('');
    clearStructured();
    setChecked(new Map());
  }

  function handleStructure(text: string) {
    setState('processing');
    structure({
      text,
      mode: 'items',
      context: { binName, existingItems },
      locationId: activeLocationId,
    }).then((items) => {
      if (items) {
        const initial = new Map<number, boolean>();
        for (let i = 0; i < items.length; i++) initial.set(i, true);
        setChecked(initial);
        setState('preview');
      } else {
        setState('expanded');
      }
    });
  }

  async function handleAdd() {
    const trimmed = value.trim();
    if (!trimmed || !binId) return;
    setSaving(true);
    try {
      if (trimmed.includes(',')) {
        const newItems = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
        if (newItems.length > 0) {
          await addItemsToBin(binId, newItems);
          showToast({ message: `Added ${newItems.length} items` });
        }
      } else {
        await addItemsToBin(binId, [trimmed]);
      }
      setValue('');
    } catch {
      showToast({ message: 'Failed to add item' });
    } finally {
      setSaving(false);
    }
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n') || !binId) return;
    e.preventDefault();
    const newItems = text.split('\n').map((s) => s.trim()).filter(Boolean);
    if (newItems.length === 0) return;
    setSaving(true);
    try {
      await addItemsToBin(binId, newItems);
      showToast({ message: `Added ${newItems.length} items` });
      setValue('');
    } catch {
      showToast({ message: 'Failed to add items' });
    } finally {
      setSaving(false);
    }
  }

  function handleAiClick() {
    if (!aiConfigured) {
      onNavigateAiSetup();
      return;
    }
    clearStructured();
    if (value.trim()) {
      const text = value.trim();
      setExpandedText(text);
      setValue('');
      handleStructure(text);
    } else {
      setExpandedText('');
      setState('expanded');
    }
  }

  function handleExpandedKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!expandedText.trim() || isStructuring) return;
      handleStructure(expandedText.trim());
    } else if (e.key === 'Escape') {
      e.preventDefault();
      reset();
    }
  }

  function handleExtractClick() {
    if (!expandedText.trim() || isStructuring) return;
    handleStructure(expandedText.trim());
  }

  function toggleChecked(index: number) {
    setChecked((prev) => {
      const next = new Map(prev);
      next.set(index, !(prev.get(index) ?? true));
      return next;
    });
  }

  async function handleConfirmAdd() {
    if (!structuredItems || !binId) return;
    const selected = structuredItems.filter((_, i) => checked.get(i) !== false);
    if (selected.length === 0) return;
    try {
      await addItemsToBin(binId, selected);
      showToast({ message: `Added ${selected.length} item${selected.length !== 1 ? 's' : ''}` });
    } catch {
      showToast({ message: 'Failed to add items' });
    }
    reset();
  }

  function backToExpanded() {
    clearStructured();
    setChecked(new Map());
    setState('expanded');
  }

  const selectedCount = structuredItems
    ? structuredItems.filter((_, i) => checked.get(i) !== false).length
    : 0;

  return {
    value,
    setValue,
    saving,
    state,
    expandedText,
    setExpandedText,
    checked,
    structuredItems,
    isStructuring,
    structureError,
    selectedCount,
    handleAdd,
    handlePaste,
    handleAiClick,
    handleExpandedKeyDown,
    handleExtractClick,
    toggleChecked,
    handleConfirmAdd,
    backToExpanded,
    cancelExpanded: reset,
  };
}
