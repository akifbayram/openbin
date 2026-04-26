import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { setCapturedReturnTarget } from '@/features/capture/capturedPhotos';
import { useReopenCreateOnCapture } from '@/features/capture/useAutoOpenOnCapture';
import { useActiveLocation } from '@/features/locations/useLocations';
import { BinCreateForm } from './BinCreateForm';

export function NewBinPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeLocation = useActiveLocation();

  const [initialPhotos, setInitialPhotos] = useState<File[] | null>(null);
  // TODO(Task 4): wire initialGroups into BinCreateForm once it accepts the prop
  const [_initialGroups, setInitialGroups] = useState<number[] | null>(null);

  // TODO(Task 9): useReopenCreateOnCapture will be updated to pass groups as second arg.
  // The extra parameter is unused until then (groups will be undefined, treated as null).
  const handleReopen = useCallback((files: File[], groups: number[] | null) => {
    setInitialPhotos(files.length > 0 ? files : null);
    setInitialGroups(groups ?? null);
  }, []);
  useReopenCreateOnCapture(handleReopen as (photos: File[]) => void);

  // Auto-open camera once on mount when ?camera=open is present.
  const cameraAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (cameraAutoOpenedRef.current) return;
    if (searchParams.get('camera') !== 'open') return;
    cameraAutoOpenedRef.current = true;
    setCapturedReturnTarget('bin-create');
    navigate('/capture', { state: { returnTo: location.pathname } });
  }, [searchParams, navigate, location.pathname]);

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
        onSubmit={() => { /* wired in Task 5 */ }}
        showCancel
        onCancel={handleCancel}
        initialPhotos={initialPhotos}
        onInitialPhotosConsumed={handleConsumed}
        // TODO(Task 4): pass initialGroups={initialGroups} once BinCreateForm accepts the prop
      />
    </div>
  );
}
