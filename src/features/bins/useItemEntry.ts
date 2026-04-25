import { isRecordingSupported } from '@/lib/audioRecorder';
import { useDictation } from '@/lib/useDictation';
import type { AiSettings, BinItem } from '@/types';
import { useQuickAdd } from './useQuickAdd';

interface UseItemEntryOptions {
  binName: string;
  existingItems: string[];
  locationId: string | undefined;
  aiReady: boolean;
  aiSettings: AiSettings | null;
  onAdd: (items: BinItem[]) => void;
  onNavigateAiSetup: () => void;
}

/**
 * Composes `useQuickAdd` + `useDictation` and derives `canTranscribe` — the
 * trio every bin item-entry surface needs together. Anthropic doesn't support
 * audio transcription, so dictation is gated on a non-Anthropic provider with
 * a working MediaRecorder.
 */
export function useItemEntry({
  binName,
  existingItems,
  locationId,
  aiReady,
  aiSettings,
  onAdd,
  onNavigateAiSetup,
}: UseItemEntryOptions) {
  const quickAdd = useQuickAdd({
    binName,
    existingItems,
    activeLocationId: locationId,
    aiConfigured: aiReady,
    onNavigateAiSetup,
    onAdd,
  });

  const dictation = useDictation({
    binName,
    existingItems,
    locationId,
    onAdd,
  });

  const canTranscribe =
    aiReady && !!aiSettings?.provider && aiSettings.provider !== 'anthropic' && isRecordingSupported();

  return { quickAdd, dictation, canTranscribe };
}
