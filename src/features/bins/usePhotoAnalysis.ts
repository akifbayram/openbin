import { useState, useRef, useEffect } from 'react';
import { analyzeImageFiles, MAX_AI_PHOTOS } from '@/features/ai/useAiAnalysis';
import { compressImage } from '@/features/photos/compressImage';
import type { AiSuggestions } from '@/types';

interface UsePhotoAnalysisOptions {
  locationId: string;
  mode: 'full' | 'onboarding';
  aiConfigured: boolean;
  onApplyDirect?: (result: AiSuggestions) => void;
  onAiSetupNeeded?: () => void;
}

export function usePhotoAnalysis({
  locationId,
  mode,
  aiConfigured,
  onApplyDirect,
  onAiSetupNeeded,
}: UsePhotoAnalysisOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AiSuggestions | null>(null);

  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviews]);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files).slice(0, MAX_AI_PHOTOS - photos.length);
    if (newFiles.length === 0) return;
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setPhotos((prev) => [...prev, ...newFiles]);
    setPhotoPreviews((prev) => [...prev, ...newPreviews]);
    setSuggestions(null);
    setAnalyzeError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleRemovePhoto(index: number) {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    setSuggestions(null);
    setAnalyzeError(null);
  }

  async function handleAnalyze() {
    if (photos.length === 0) return;
    if (!aiConfigured) {
      onAiSetupNeeded?.();
      return;
    }
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const compressedFiles = await Promise.all(
        photos.map(async (p) => {
          const compressed = await compressImage(p);
          return compressed instanceof File
            ? compressed
            : new File([compressed], p.name, { type: compressed.type || 'image/jpeg' });
        })
      );
      const result = await analyzeImageFiles(compressedFiles, locationId);
      if (mode === 'onboarding') {
        onApplyDirect?.(result);
      } else {
        setSuggestions(result);
      }
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Failed to analyze photos');
    } finally {
      setAnalyzing(false);
    }
  }

  function dismissSuggestions() {
    setSuggestions(null);
  }

  return {
    fileInputRef,
    photos,
    photoPreviews,
    analyzing,
    analyzeError,
    suggestions,
    dismissSuggestions,
    handlePhotoSelect,
    handleRemovePhoto,
    handleAnalyze,
  };
}
