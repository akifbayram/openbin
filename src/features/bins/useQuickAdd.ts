import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { DEMO_STRUCTURE_TEXT, DEMO_STRUCTURED_ITEMS } from '@/features/ai/demoAiScenarios';
import { useTextStructuring } from '@/features/ai/useTextStructuring';
import { useAuth } from '@/lib/auth';
import { clientItemId, parseItemQuantity, toItemPayload } from '@/lib/itemQuantities';
import type { BinItem } from '@/types';
import { addItemsToBin } from './useBins';

type QuickAddState = 'input' | 'expanded' | 'processing' | 'preview';

interface UseQuickAddOptions {
  binId?: string;
  binName: string;
  existingItems: string[];
  activeLocationId: string | undefined;
  aiConfigured?: boolean;
  onNavigateAiSetup?: () => void;
  onAdd?: (items: BinItem[]) => void;
}

export function useQuickAdd(options: UseQuickAddOptions) {
  const { binId, binName, existingItems, activeLocationId, aiConfigured = false, onNavigateAiSetup = () => {}, onAdd } = options;
  const { showToast } = useToast();
  const { demoMode } = useAuth();

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
    setStructuredItems,
  } = useTextStructuring();

  function reset() {
    setState('input');
    setExpandedText('');
    clearStructured();
    setChecked(new Map());
  }

  function handleStructure(text: string) {
    if (demoMode) {
      setState('processing');
      setTimeout(() => {
        setStructuredItems(DEMO_STRUCTURED_ITEMS);
        const initial = new Map<number, boolean>();
        for (let i = 0; i < DEMO_STRUCTURED_ITEMS.length; i++) initial.set(i, true);
        setChecked(initial);
        setState('preview');
      }, 600);
      return;
    }
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
    if (!trimmed || (!binId && !onAdd) || saving) return;
    setSaving(true);
    try {
      const segments = trimmed.includes(',')
        ? trimmed.split(',').map((s) => s.trim()).filter(Boolean)
        : [trimmed];
      const parsed = segments.map((s) => parseItemQuantity(s));
      if (onAdd) {
        const binItems: BinItem[] = parsed.map((p) => ({ id: clientItemId(), name: p.name, quantity: p.quantity }));
        onAdd(binItems);
      } else {
        const items = parsed.map((p) => toItemPayload(p));
        if (items.length > 0 && binId) {
          await addItemsToBin(binId, items);
          showToast({ message: `Added ${items.length} item${items.length !== 1 ? 's' : ''}` });
        }
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
    if (!text.includes('\n') || (!binId && !onAdd)) return;
    e.preventDefault();
    const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const capped = lines.slice(0, 500);
    if (lines.length > 500) {
      showToast({ message: `Pasted ${lines.length} lines — only the first 500 will be added`, variant: 'warning' });
    }
    const parsed = capped.map((s) => parseItemQuantity(s));
    setSaving(true);
    try {
      if (onAdd) {
        const binItems: BinItem[] = parsed.map((p) => ({ id: clientItemId(), name: p.name, quantity: p.quantity }));
        onAdd(binItems);
      } else {
        const items = parsed.map((p) => toItemPayload(p));
        if (binId) {
          await addItemsToBin(binId, items);
          showToast({ message: `Added ${items.length} items` });
        }
      }
      setValue('');
    } catch {
      showToast({ message: 'Failed to add items' });
    } finally {
      setSaving(false);
    }
  }

  function handleAiClick() {
    if (demoMode) {
      setExpandedText(DEMO_STRUCTURE_TEXT);
      setState('expanded');
      return;
    }
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
    if (!structuredItems || (!binId && !onAdd)) return;
    const selected = structuredItems.filter((_, i) => checked.get(i) !== false);
    if (selected.length === 0) return;
    try {
      if (onAdd) {
        const binItems: BinItem[] = selected.map((item) => ({
          id: clientItemId(),
          name: item.name,
          quantity: item.quantity ?? null,
        }));
        onAdd(binItems);
      } else {
        const items = selected.map((item) => item.quantity ? { name: item.name, quantity: item.quantity } : item.name);
        if (binId) {
          await addItemsToBin(binId, items);
          showToast({ message: `Added ${selected.length} item${selected.length !== 1 ? 's' : ''}` });
        }
      }
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
