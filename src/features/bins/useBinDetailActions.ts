import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/toast';
import { useAiAnalysis } from '@/features/ai/useAiAnalysis';
import { useAiSettings } from '@/features/ai/useAiSettings';
import { useLocationList } from '@/features/locations/useLocations';
import { usePhotos } from '@/features/photos/usePhotos';
import { pinBin, unpinBin } from '@/features/pins/usePins';
import { useAiEnabled } from '@/lib/aiToggle';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { usePermissions } from '@/lib/usePermissions';
import type { Bin } from '@/types';
import { addBin, deleteBin, moveBin, restoreBin, updateBin } from './useBins';
import { useQuickAdd } from './useQuickAdd';

export function useBinDetailActions(bin: Bin | null | undefined, id: string | undefined, editing: boolean) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { activeLocationId } = useAuth();
  const { isAdmin, canEditBin, canChangeVisibility } = usePermissions();
  const { aiEnabled } = useAiEnabled();
  const t = useTerminology();

  const { locations } = useLocationList();
  const otherLocations = locations.filter((l) => l.id !== bin?.location_id);

  const { photos } = usePhotos(id);
  const { settings: aiSettings } = useAiSettings();
  const { suggestions, isAnalyzing, error: aiError, analyzeMultiple, clearSuggestions } = useAiAnalysis();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [aiSetupOpen, setAiSetupOpen] = useState(false);

  const quickAdd = useQuickAdd({
    binId: id,
    binName: bin?.name ?? '',
    existingItems: bin?.items.map((i) => i.name) ?? [],
    activeLocationId: activeLocationId ?? undefined,
    aiConfigured: aiEnabled && !!aiSettings,
    onNavigateAiSetup: () => setAiSetupOpen(true),
  });

  async function handleDelete() {
    if (!id || !bin) return;
    const snapshot: Bin = { ...bin };
    await deleteBin(id);
    navigate('/bins');
    showToast({
      message: `Deleted "${snapshot.name}"`,
      action: {
        label: 'Undo',
        onClick: () => restoreBin(snapshot),
      },
    });
  }

  async function handleMove(targetId: string) {
    if (!id || !bin) return;
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
  }

  function handleAnalyzeClick() {
    if (!aiSettings) {
      setAiSetupOpen(true);
      return;
    }
    if (photos.length > 0) {
      analyzeMultiple(photos.map((p) => p.id));
    }
  }

  async function handleApplySuggestions(changes: Partial<{ name: string; items: string[]; tags: string[]; notes: string }>) {
    if (!id || Object.keys(changes).length === 0) return;
    try {
      await updateBin(id, changes);
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
      });
      navigate(`/bin/${newBin.id}`);
      showToast({ message: `Duplicated "${bin.name}"` });
    } catch {
      showToast({ message: 'Failed to duplicate' });
    }
  }

  async function handleTogglePin() {
    if (!bin) return;
    if (bin.is_pinned) {
      await unpinBin(bin.id);
      showToast({ message: 'Unpinned' });
    } else {
      await pinBin(bin.id);
      showToast({ message: 'Pinned' });
    }
  }

  const canEdit = bin ? canEditBin(bin.created_by) : false;
  const canDelete = isAdmin;
  const showAiButton = aiEnabled && photos.length > 0 && !editing;
  const hasNotes = !!bin?.notes;
  const hasTags = (bin?.tags.length ?? 0) > 0;

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
    // Data
    photos,
    aiSettings,
    otherLocations,
    quickAdd,
    // Flags
    canEdit,
    canDelete,
    canChangeVisibility,
    showAiButton,
    hasNotes,
    hasTags,
    aiEnabled,
    activeLocationId,
    // Dialog state
    deleteOpen, setDeleteOpen,
    moveOpen, setMoveOpen,
    aiSetupOpen, setAiSetupOpen,
  };
}
