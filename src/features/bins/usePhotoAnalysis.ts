import { useCallback, useEffect, useRef, useState } from 'react';
import { mapAiError } from '@/features/ai/aiErrors';
import { analyzeImageFiles, MAX_AI_PHOTOS } from '@/features/ai/useAiAnalysis';
import { compressImage } from '@/features/photos/compressImage';
import { apiStream } from '@/lib/apiStream';
import { getErrorMessage } from '@/lib/utils';
import type { AiSuggestions } from '@/types';

interface UsePhotoAnalysisOptions {
  locationId: string;
  aiConfigured: boolean;
  onApplyDirect?: (result: AiSuggestions) => void;
  onAiSetupNeeded?: () => void;
}

async function compressPhotos(photos: File[]): Promise<File[]> {
  return Promise.all(
    photos.map(async (p) => {
      const compressed = await compressImage(p);
      return compressed instanceof File
        ? compressed
        : new File([compressed], p.name, { type: compressed.type || 'image/jpeg' });
    })
  );
}

export function usePhotoAnalysis({
  locationId,
  aiConfigured,
  onApplyDirect,
  onAiSetupNeeded,
}: UsePhotoAnalysisOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      for (const url of photoPreviews) URL.revokeObjectURL(url);
      abortRef.current?.abort();
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
    setAnalyzeError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleRemovePhoto(index: number) {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    setAnalyzeError(null);
  }

  const addPhotosFromFiles = useCallback((files: File[]) => {
    setPhotos((prev) => {
      const remaining = MAX_AI_PHOTOS - prev.length;
      if (remaining <= 0) return prev;
      const newFiles = files.slice(0, remaining);
      const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
      setPhotoPreviews((prevPreviews) => [...prevPreviews, ...newPreviews]);
      setAnalyzeError(null);
      return [...prev, ...newFiles];
    });
  }, []);

  async function handleAnalyze() {
    if (photos.length === 0) return;
    if (!aiConfigured) {
      onAiSetupNeeded?.();
      return;
    }
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const compressed = await compressPhotos(photos);
      const result = await analyzeImageFiles(compressed, locationId);
      onApplyDirect?.(result);
    } catch (err) {
      setAnalyzeError(getErrorMessage(err, 'Failed to analyze photos'));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleReanalyze(previousResult: AiSuggestions) {
    if (photos.length === 0) return;
    if (!aiConfigured) {
      onAiSetupNeeded?.();
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const compressed = await compressPhotos(photos);
      const formData = new FormData();
      if (compressed.length === 1) {
        formData.append('photo', compressed[0]);
      } else {
        for (const file of compressed) formData.append('photos', file);
      }
      formData.append('previousResult', JSON.stringify(previousResult));
      if (locationId) formData.append('locationId', locationId);

      let result: AiSuggestions | null = null;
      for await (const event of apiStream('/api/ai/reanalyze-image/stream', { body: formData, signal: controller.signal })) {
        if (event.type === 'done') {
          const text = event.text.trim();
          if (text) result = JSON.parse(text) as AiSuggestions;
        } else if (event.type === 'error') {
          throw new Error(event.message);
        }
      }
      if (result) {
        onApplyDirect?.(result);
      } else {
        throw new Error('Empty response from AI');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setAnalyzeError(mapAiError(err, 'Failed to reanalyze photos'));
      }
    } finally {
      setAnalyzing(false);
      abortRef.current = null;
    }
  }

  return {
    fileInputRef,
    photos,
    photoPreviews,
    analyzing,
    analyzeError,
    handlePhotoSelect,
    handleRemovePhoto,
    handleAnalyze,
    handleReanalyze,
    addPhotosFromFiles,
  };
}
