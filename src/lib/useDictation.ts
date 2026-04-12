import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useTextStructuring } from '@/features/ai/useTextStructuring';
import { addItemsToBin } from '@/features/bins/useBins';
import { clientItemId } from '@/lib/itemQuantities';
import { useTranscription } from '@/lib/useTranscription';
import type { AiSuggestedItem, BinItem } from '@/types';

export type DictationState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'previewing-transcript'
  | 'structuring'
  | 'preview';

interface UseDictationOptions {
  binId?: string;
  binName: string;
  existingItems: string[];
  locationId: string | undefined;
  /** Callback for bin-create flow where binId isn't known yet. */
  onAdd?: (items: BinItem[]) => void;
}

export function useDictation(options: UseDictationOptions) {
  const { binId, binName, existingItems, locationId, onAdd } = options;
  const { showToast } = useToast();

  const existingItemsKey = existingItems.join('\0');
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional content-based stabilization
  const stableExistingItems = useMemo(() => existingItems, [existingItemsKey]);

  const [itemState, setItemState] = useState<'idle' | 'previewing-transcript' | 'structuring' | 'preview'>('idle');
  const [transcript, setTranscript] = useState<string | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const {
    structuredItems,
    structure,
    clearStructured,
  } = useTextStructuring();

  // Cleanup auto-advance timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, []);

  const advanceToStructuring = useCallback(
    (text: string) => {
      setItemState('structuring');
      structure({
        text,
        mode: 'items',
        context: { binName, existingItems: stableExistingItems },
        locationId,
      }).then((items) => {
        if (cancelledRef.current) return;
        if (items && items.length > 0) {
          setItemState('preview');
        } else {
          showToast({ message: 'No items found in transcription', variant: 'warning' });
          setItemState('idle');
          setTranscript(null);
          clearStructured();
        }
      }).catch(() => {
        if (cancelledRef.current) return;
        setItemState('idle');
        setTranscript(null);
      });
    },
    [structure, binName, stableExistingItems, locationId, showToast, clearStructured],
  );

  const handleTranscribed = useCallback((text: string) => {
    setTranscript(text);
    setItemState('previewing-transcript');
    autoAdvanceRef.current = setTimeout(() => {
      autoAdvanceRef.current = null;
      if (!cancelledRef.current) advanceToStructuring(text);
    }, 1500);
  }, [advanceToStructuring]);

  const transcription = useTranscription({ onTranscribed: handleTranscribed });

  // Composite state: transcription states pass through, item states overlay
  const state: DictationState = itemState !== 'idle' ? itemState : transcription.state;

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    transcription.cancel();
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    setItemState('idle');
    setTranscript(null);
    clearStructured();
  }, [transcription, clearStructured]);

  const start = useCallback(async () => {
    cancelledRef.current = false;
    setTranscript(null);
    clearStructured();
    setItemState('idle');
    transcription.start();
  }, [transcription, clearStructured]);

  const editTranscript = useCallback(
    (text: string) => {
      if (autoAdvanceRef.current) {
        clearTimeout(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
      setTranscript(text);
    },
    [],
  );

  const submitEditedTranscript = useCallback(() => {
    if (transcript?.trim()) {
      advanceToStructuring(transcript.trim());
    }
  }, [transcript, advanceToStructuring]);

  const confirm = useCallback(
    async (selected: AiSuggestedItem[]) => {
      if (selected.length === 0) return;
      try {
        if (onAdd) {
          const binItems: BinItem[] = selected.map((item) => ({
            id: clientItemId(),
            name: item.name,
            quantity: item.quantity ?? null,
          }));
          onAdd(binItems);
        } else if (binId) {
          const items = selected.map((item) =>
            item.quantity ? { name: item.name, quantity: item.quantity } : item.name,
          );
          await addItemsToBin(binId, items);
        }
        showToast({
          message: `Added ${selected.length} item${selected.length !== 1 ? 's' : ''} from dictation`,
        });
      } catch {
        showToast({ message: 'Failed to add items', variant: 'error' });
      }
      setItemState('idle');
      setTranscript(null);
      clearStructured();
    },
    [binId, onAdd, showToast, clearStructured],
  );

  return {
    state,
    transcript,
    error: transcription.error,
    duration: transcription.duration,
    structuredItems,
    start,
    stop: transcription.stop,
    cancel,
    confirm,
    editTranscript,
    submitEditedTranscript,
  };
}
