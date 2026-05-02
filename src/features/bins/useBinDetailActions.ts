import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/toast';
import { useAiSettings } from '@/features/ai/useAiSettings';
import { useAiStream } from '@/features/ai/useAiStream';
import { useLocationList } from '@/features/locations/useLocations';
import { usePhotos } from '@/features/photos/usePhotos';
import { pinBin, unpinBin } from '@/features/pins/usePins';
import { useAiEnabled } from '@/lib/aiToggle';
import { isRecordingSupported } from '@/lib/audioRecorder';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { useDictation } from '@/lib/useDictation';
import { usePermissions } from '@/lib/usePermissions';
import type { AiSuggestions, Bin } from '@/types';
import { addBin, deleteBin, moveBin, restoreBin, updateBin } from './useBins';
import { useQuickAdd } from './useQuickAdd';

export function useBinDetailActions(bin: Bin | null | undefined, id: string | undefined) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { activeLocationId } = useAuth();
  const { isAdmin, canWrite, canChangeVisibility, canDeleteBin, canPin } = usePermissions();
  const { aiEnabled, aiGated } = useAiEnabled();
  const t = useTerminology();

  const { locations } = useLocationList();
  const otherLocations = locations.filter((l) => l.id !== bin?.location_id);

  const { photos } = usePhotos(id);
  const { settings: aiSettings } = useAiSettings();
  const analyze = useAiStream<AiSuggestions>('/api/ai/analyze/stream', "Couldn't analyze the photo — try again");
  const reanalyze = useAiStream<AiSuggestions>('/api/ai/reanalyze/stream', "Couldn't reanalyze the photo — try again");
  const suggestions = analyze.result ?? reanalyze.result;
  const isAnalyzing = analyze.isStreaming || reanalyze.isStreaming;
  const aiError = analyze.error ?? reanalyze.error;
  const clearSuggestions = useCallback(() => { analyze.clear(); reanalyze.clear(); }, [analyze.clear, reanalyze.clear]);
  const [lastSuggestions, setLastSuggestions] = useState<AiSuggestions | null>(null);

  const [moveOpen, setMoveOpen] = useState(false);
  const [aiSetupOpen, setAiSetupOpen] = useState(false);
  const [changeCodeOpen, setChangeCodeOpen] = useState(false);

  const quickAdd = useQuickAdd({
    binId: id,
    binName: bin?.name ?? '',
    existingItems: bin?.items.map((i) => i.name) ?? [],
    activeLocationId: activeLocationId ?? undefined,
    aiConfigured: aiEnabled && !!aiSettings,
    onNavigateAiSetup: () => setAiSetupOpen(true),
  });

  const dictation = useDictation({
    binId: id,
    binName: bin?.name ?? '',
    existingItems: bin?.items.map((i) => i.name) ?? [],
    locationId: activeLocationId ?? undefined,
  });

  const canTranscribe = aiEnabled && !!aiSettings && aiSettings.provider !== 'anthropic' && isRecordingSupported();

  async function handleDelete() {
    if (!id || !bin) return;
    try {
      const snapshot: Bin = { ...bin };
      await deleteBin(id);
      navigate('/bins');
      showToast({
        message: `Deleted "${snapshot.name}"`,
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: () => restoreBin(snapshot),
        },
      });
    } catch {
      showToast({ message: 'Failed to delete' });
    }
  }

  async function handleMove(targetId: string) {
    if (!id || !bin) return;
    try {
      const originalLocationId = bin.location_id;
      const targetLoc = locations.find((l) => l.id === targetId);
      await moveBin(id, targetId);
      setMoveOpen(false);
      navigate('/bins');
      showToast({
        message: `Moved to ${targetLoc?.name ?? t.location}`,
        action: {
          label: 'Undo',
          onClick: async () => {
            await moveBin(id, originalLocationId);
          },
        },
      });
    } catch {
      showToast({ message: 'Failed to move' });
    }
  }

  function handleAnalyzeClick() {
    if (!aiSettings) {
      setAiSetupOpen(true);
      return;
    }
    if (photos.length > 0) {
      const photoIds = photos.map((p) => p.id);
      const context = lastSuggestions ?? (bin && (bin.name || bin.items.length > 0)
        ? { name: bin.name, items: bin.items.map((i) => ({ name: i.name, quantity: i.quantity })) }
        : null);
      if (context) {
        analyze.clear();
        reanalyze.stream({ photoIds, previousResult: context });
      } else {
        reanalyze.clear();
        analyze.stream({ photoIds });
      }
    }
  }

  async function handleApplySuggestions(changes: Partial<{ name: string; items: { name: string; quantity?: number | null }[] }>) {
    if (!id || Object.keys(changes).length === 0) return;
    try {
      await updateBin(id, changes);
      if (suggestions) setLastSuggestions(suggestions);
      clearSuggestions();
      showToast({ message: 'Applied AI suggestions' });
    } catch {
      showToast({ message: 'Failed to apply suggestions' });
    }
  }

  async function handleDuplicate() {
    if (!bin || !activeLocationId) return;
    try {
      const newBin = await addBin({
        name: `${bin.name} (copy)`,
        locationId: activeLocationId,
        items: bin.items.map((i) => i.name),
        notes: bin.notes,
        tags: [...bin.tags],
        areaId: bin.area_id,
        icon: bin.icon,
        color: bin.color,
        cardStyle: bin.card_style,
        visibility: bin.visibility,
        customFields: bin.custom_fields ? { ...bin.custom_fields } : undefined,
      });
      navigate(`/bin/${newBin.id}`);
      showToast({ message: photos.length > 0 ? `Duplicated "${bin.name}" (photos not copied)` : `Duplicated "${bin.name}"` });
    } catch {
      showToast({ message: 'Failed to duplicate' });
    }
  }

  async function handleTogglePin() {
    if (!bin) return;
    try {
      if (bin.is_pinned) {
        await unpinBin(bin.id);
        showToast({ message: 'Unpinned' });
      } else {
        await pinBin(bin.id);
        showToast({ message: 'Pinned' });
      }
    } catch {
      showToast({ message: 'Failed to update pin' });
    }
  }

  const canEdit = bin ? canWrite : false;
  const canDelete = bin ? canDeleteBin(bin.created_by) : false;
  const showAiButton = canWrite && (aiEnabled || aiGated) && photos.length > 0;
  const isReanalysis = !!(lastSuggestions || (bin && (bin.name || bin.items.length > 0)));

  return {
    // Actions
    handleDelete,
    handleMove,
    handleAnalyzeClick,
    handleApplySuggestions,
    handleDuplicate,
    handleTogglePin,
    // AI state
    suggestions,
    isAnalyzing,
    aiError,
    clearSuggestions,
    isReanalysis,
    lastSuggestions,
    // Data
    photos,
    otherLocations,
    quickAdd,
    dictation,
    canTranscribe,
    // Flags
    canEdit,
    canDelete,
    canPin,
    canChangeVisibility,
    showAiButton,
    aiEnabled,
    aiGated,
    activeLocationId,
    // Dialog state
    moveOpen, setMoveOpen,
    aiSetupOpen, setAiSetupOpen,
    changeCodeOpen, setChangeCodeOpen,
    isAdmin,
  };
}
