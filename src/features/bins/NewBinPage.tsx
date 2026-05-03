import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { setCapturedReturnTarget } from '@/features/capture/capturedPhotos';
import { useReopenCreateOnCapture } from '@/features/capture/useAutoOpenOnCapture';
import { useActiveLocation } from '@/features/locations/useLocations';
import type { BinCreateFormData } from './BinCreateForm';
import { BinCreateForm } from './BinCreateForm';
import { addBin } from './useBins';

export function NewBinPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeLocation = useActiveLocation();

  const [initialPhotos, setInitialPhotos] = useState<File[] | null>(null);
  const [initialGroups, setInitialGroups] = useState<number[] | null>(null);

  const handleReopen = useCallback((files: File[], groups: number[] | null) => {
    setInitialPhotos(files.length > 0 ? files : null);
    setInitialGroups(groups ?? null);
  }, []);
  useReopenCreateOnCapture(handleReopen);

  // Auto-open camera once on mount when ?camera=open is present.
  // Strip the param so a remount (after returning from /capture) doesn't re-fire.
  const cameraAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (cameraAutoOpenedRef.current) return;
    if (searchParams.get('camera') !== 'open') return;
    cameraAutoOpenedRef.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete('camera');
    setSearchParams(next, { replace: true });
    setCapturedReturnTarget('bin-create');
    navigate('/capture', { state: { returnTo: location.pathname } });
  }, [searchParams, setSearchParams, navigate, location.pathname]);

  const galleryRequested = searchParams.get('gallery') === 'open';
  const galleryConsumedRef = useRef(false);
  useEffect(() => {
    if (galleryConsumedRef.current) return;
    if (!galleryRequested) return;
    galleryConsumedRef.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete('gallery');
    setSearchParams(next, { replace: true });
  }, [galleryRequested, searchParams, setSearchParams]);

  const handleSubmit = useCallback(async (data: BinCreateFormData) => {
    if (!activeLocation) return;
    const bin = await addBin({
      locationId: activeLocation.id,
      name: data.name,
      items: data.items,
      notes: data.notes,
      tags: data.tags,
      areaId: data.areaId,
      icon: data.icon,
      color: data.color,
      cardStyle: data.cardStyle || undefined,
      visibility: data.visibility,
      customFields: data.customFields,
    });
    navigate(`/bin/${bin.id}`);
  }, [activeLocation, navigate]);

  const handleWizardComplete = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const fromAsk = searchParams.get('from') === 'ask';
  const handleCancel = useCallback(() => {
    if (fromAsk) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }, [fromAsk, navigate]);

  const handleConsumed = useCallback(() => {
    setInitialPhotos(null);
    setInitialGroups(null);
  }, []);

  if (!activeLocation) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <BinCreateForm
        mode="full"
        locationId={activeLocation.id}
        onSubmit={handleSubmit}
        onWizardComplete={handleWizardComplete}
        showCancel
        onCancel={handleCancel}
        initialPhotos={initialPhotos}
        onInitialPhotosConsumed={handleConsumed}
        initialGroups={initialGroups}
        triggerFilePickerOnMount={galleryRequested}
      />
    </div>
  );
}
