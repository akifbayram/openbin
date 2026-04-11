import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { mapAiError } from '@/features/ai/aiErrors';
import { useTextStructuring } from '@/features/ai/useTextStructuring';
import { addItemsToBin } from '@/features/bins/useBins';
import { apiFetch } from '@/lib/api';
import type { RecordingHandle } from '@/lib/audioRecorder';
import { startRecording } from '@/lib/audioRecorder';
import { Events, notify } from '@/lib/eventBus';
import { clientItemId } from '@/lib/itemQuantities';
import type { AiSuggestedItem, BinItem } from '@/types';

export type DictationState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'previewing-transcript'
  | 'structuring'
  | 'preview';

interface TranscribeResponse {
  text: string;
}

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

  // Stabilize existingItems to avoid rebuilding the callback chain on every render.
  // The key is a content-based string so the memo only updates when items actually change.
  const existingItemsKey = existingItems.join('\0');
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional content-based stabilization
  const stableExistingItems = useMemo(() => existingItems, [existingItemsKey]);

  const [state, setState] = useState<DictationState>('idle');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const recordingRef = useRef<RecordingHandle | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const startRef = useRef<() => void>(() => {});

  const {
    structuredItems,
    structure,
    clearStructured,
  } = useTextStructuring();

  // Tick elapsed time during recording
  const isRecording = state === 'recording';
  useEffect(() => {
    if (!isRecording) return;
    setDuration(0);
    const id = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recordingRef.current?.cancel();
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    recordingRef.current?.cancel();
    recordingRef.current = null;
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    setState('idle');
    setTranscript(null);
    setError(null);
    setDuration(0);
    clearStructured();
  }, [clearStructured]);

  const advanceToStructuring = useCallback(
    (text: string) => {
      setState('structuring');
      structure({
        text,
        mode: 'items',
        context: { binName, existingItems: stableExistingItems },
        locationId,
      }).then((items) => {
        if (cancelledRef.current) return;
        if (items && items.length > 0) {
          setState('preview');
        } else {
          showToast({ message: 'No items found in transcription', variant: 'warning' });
          setState('idle');
          setTranscript(null);
          clearStructured();
        }
      }).catch(() => {
        if (cancelledRef.current) return;
        setState('idle');
        setTranscript(null);
      });
    },
    [structure, binName, stableExistingItems, locationId, showToast, clearStructured],
  );

  const handleStopInternal = useCallback(async () => {
    const handle = recordingRef.current;
    if (!handle) return;
    recordingRef.current = null;

    setState('transcribing');
    try {
      const blob = await handle.stop();
      if (blob.size < 1000) {
        showToast({ message: 'No audio recorded', variant: 'warning' });
        setState('idle');
        return;
      }

      const formData = new FormData();
      let ext = 'webm';
      if (blob.type.includes('mp4')) ext = 'mp4';
      else if (blob.type.includes('ogg')) ext = 'ogg';
      formData.append('audio', blob, `recording.${ext}`);
      const result = await apiFetch<TranscribeResponse>('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      });
      notify(Events.PLAN); // AI credit used

      if (cancelledRef.current) return;

      const text = result.text.trim();
      if (!text) {
        showToast({ message: 'No speech detected. Try again.', variant: 'warning' });
        setState('idle');
        return;
      }

      setTranscript(text);
      setState('previewing-transcript');

      // Auto-advance after 1.5s
      autoAdvanceRef.current = setTimeout(() => {
        autoAdvanceRef.current = null;
        if (!cancelledRef.current) advanceToStructuring(text);
      }, 1500);
    } catch (err) {
      if (cancelledRef.current) return;
      const message = mapAiError(err, 'Transcription failed. Try again.');
      setError(message);
      showToast({
        message,
        variant: 'error',
        action: { label: 'Retry', onClick: () => startRef.current() },
      });
      setState('idle');
    }
  }, [showToast, advanceToStructuring]);

  const start = useCallback(async () => {
    if (state !== 'idle') return;
    cancelledRef.current = false;
    setError(null);
    setTranscript(null);
    clearStructured();

    try {
      const handle = await startRecording(() => {
        // Auto-stop callback: proceed to transcription
        handleStopInternal();
      });
      recordingRef.current = handle;
      setState('recording');
    } catch (err) {
      let message = 'Could not start recording';
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') message = 'Microphone access was denied by the browser';
        else if (err.name === 'NotFoundError') message = 'No microphone found on this device';
        else if (err.name === 'NotReadableError') message = 'Microphone is in use by another application';
        else message = `Recording error: ${err.name}`;
      }
      showToast({ message, variant: 'error' });
    }
  }, [state, clearStructured, showToast, handleStopInternal]);
  startRef.current = start;

  const stop = useCallback(() => {
    handleStopInternal();
  }, [handleStopInternal]);

  const editTranscript = useCallback(
    (text: string) => {
      // Pause auto-advance
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
      setState('idle');
      setTranscript(null);
      setDuration(0);
      clearStructured();
    },
    [binId, onAdd, showToast, clearStructured],
  );

  return {
    state,
    transcript,
    error,
    duration,
    structuredItems,
    start,
    stop,
    cancel,
    confirm,
    editTranscript,
    submitEditedTranscript,
  };
}
