import { Camera, Check, RotateCcw, SwitchCamera, X } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TourLauncher } from '@/features/tour/TourLauncher';
import { cn, focusRing } from '@/lib/utils';
import { CapturePageBulkGroup } from './CapturePageBulkGroup';
import { setCapturedPhotos } from './capturedPhotos';
import { FirstRunCoachmark, HelpButton } from './guidance/CameraGuidance';
import type { CapturedPhoto } from './useCapture';
import { useCapture } from './useCapture';

type CaptureMode = 'single-bin' | 'bulk-group';

function resolveCaptureMode(binId: string | null): CaptureMode {
  return binId ? 'single-bin' : 'bulk-group';
}

function StatusBadge({ photo, onRetry }: { photo: CapturedPhoto; onRetry: () => void }) {
  switch (photo.status) {
    case 'pending':
    case 'uploading':
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[var(--radius-sm)]">
          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-[50%] animate-spin" />
        </div>
      );
    case 'uploaded':
      return (
        <div className="absolute bottom-0 right-0 h-5 w-5 flex items-center justify-center bg-green-600 rounded-tl-[var(--radius-sm)] rounded-br-[var(--radius-sm)]">
          <Check className="h-3 w-3 text-white" />
        </div>
      );
    case 'failed':
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-[var(--radius-sm)]"
          aria-label="Retry upload"
        >
          <RotateCcw className="h-4 w-4 text-red-400" />
        </button>
      );
    default:
      return null;
  }
}

function CapturePageLegacy({ binId }: { binId?: string }) {
  const navigate = useNavigate();

  const {
    videoRef,
    isStreaming,
    photos,
    error,
    startCamera,
    flipCamera,
    capture,
    retryUpload,
    cleanup,
  } = useCapture(binId);

  // Stop camera stream and revoke thumbnail URLs on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const handleDone = useCallback(() => {
    if (!binId && photos.length > 0) {
      const files = photos.map((p, i) =>
        new File([p.blob], `capture-${i + 1}.jpg`, { type: 'image/jpeg' }),
      );
      setCapturedPhotos(files);
    }
    navigate(-1);
  }, [binId, photos, navigate]);

  const handleClose = useCallback(() => {
    if (photos.length > 0 && !binId) {
      const ok = window.confirm(
        `Discard ${photos.length} photo${photos.length === 1 ? '' : 's'}?`,
      );
      if (!ok) return;
    }
    navigate(-1);
  }, [photos.length, binId, navigate]);

  const hasCamera = !!navigator.mediaDevices?.getUserMedia;
  const photoCountLabel = `${photos.length} photo${photos.length === 1 ? '' : 's'}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Video fills viewport; all UI layers on top */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Overlay: start screen or error (covers video when not streaming) */}
      {!isStreaming && (
        <div className="absolute inset-0 z-20 bg-[var(--bg-base)] flex flex-col items-center justify-center gap-5 px-6">
          {!hasCamera ? (
            <>
              <Camera className="h-16 w-16 text-[var(--text-tertiary)]" />
              <h2 className="text-[17px] font-semibold text-[var(--text-primary)] text-center">
                Camera not available
              </h2>
              <p className="text-[14px] text-[var(--text-secondary)] text-center max-w-sm">
                Your browser does not support camera access. Make sure you are using HTTPS.
              </p>
              <Button variant="outline" onClick={() => navigate(-1)}>
                Go Back
              </Button>
            </>
          ) : error ? (
            <>
              <Camera className="h-16 w-16 text-[var(--destructive)] opacity-60" />
              <p className="text-[15px] text-[var(--text-primary)] text-center max-w-sm font-medium">
                {error}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => navigate(-1)}>
                  Go Back
                </Button>
                <Button onClick={() => startCamera()}>Try Again</Button>
              </div>
            </>
          ) : (
            <>
              <Camera className="h-16 w-16 text-[var(--accent)] opacity-80" />
              <h2 className="text-[17px] font-semibold text-[var(--text-primary)]">
                Ready to capture
              </h2>
              <p className="text-[14px] text-[var(--text-secondary)] text-center max-w-sm">
                Tap the button below to start the camera and take photos.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button onClick={() => startCamera()}>Start Camera</Button>
              </div>
              <TourLauncher tourId="create-ai" />
            </>
          )}
        </div>
      )}

      <FirstRunCoachmark isStreaming={isStreaming} />

      {isStreaming && (
        <>
          {/* Top bar */}
          <div
            className="relative z-10 flex items-center justify-between px-3 py-2 bg-black/50"
            style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0.5rem))' }}
          >
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                focusRing,
                'h-8 w-8 flex items-center justify-center text-white/90 hover:text-white focus-visible:ring-offset-2 focus-visible:ring-offset-black',
              )}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div
              aria-live="polite"
              className="text-[11px] font-medium text-white/90 tracking-wide"
            >
              {photoCountLabel}
            </div>

            <HelpButton className="bg-transparent hover:bg-white/10" />
          </div>

          {/* Viewfinder */}
          <div className="flex-1 relative flex items-center justify-center">
            <div className="absolute inset-4 border border-dashed border-white/40 pointer-events-none">
              <div className="absolute -top-px -left-px h-4 w-4 border-t-2 border-l-2 border-[var(--accent)]" />
              <div className="absolute -top-px -right-px h-4 w-4 border-t-2 border-r-2 border-[var(--accent)]" />
              <div className="absolute -bottom-px -left-px h-4 w-4 border-b-2 border-l-2 border-[var(--accent)]" />
              <div className="absolute -bottom-px -right-px h-4 w-4 border-b-2 border-r-2 border-[var(--accent)]" />
            </div>
            {photos.length === 0 && (
              <p className="relative text-[13px] text-white/55 font-medium text-center px-6">
                tap shutter to capture
              </p>
            )}
          </div>

          {/* Thumbnail strip */}
          <div
            className="relative z-10 bg-black/50 overflow-x-auto overflow-y-hidden"
            style={{ minHeight: 56 }}
          >
            {photos.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-white/40 italic">
                No photos yet
              </div>
            ) : (
              <ul className="flex items-center gap-[2px] px-3 py-2">
                {photos.map((photo) => (
                  <li key={photo.id} className="relative h-11 w-11 flex-shrink-0">
                    <img
                      src={photo.thumbnailUrl}
                      alt=""
                      className="h-full w-full rounded-[var(--radius-sm)] object-cover"
                    />
                    <StatusBadge photo={photo} onRetry={() => retryUpload(photo.id)} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Bottom controls */}
          <div
            className="relative z-10 flex items-center justify-between px-4 pt-2 pb-4 bg-black/50"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
          >
            <button
              type="button"
              onClick={flipCamera}
              aria-label="Flip camera"
              className={cn(
                focusRing,
                'w-[54px] h-11 flex items-center justify-center text-white/80 hover:text-white transition-colors focus-visible:ring-offset-2 focus-visible:ring-offset-black',
              )}
            >
              <SwitchCamera className="h-6 w-6" />
            </button>

            <button
              type="button"
              onClick={() => capture()}
              data-tour="capture-camera"
              aria-label="Take photo"
              className={cn(
                focusRing,
                'h-[54px] w-[54px] rounded-[50%] border-[3px] border-white flex items-center justify-center active:scale-95 transition-transform relative focus-visible:ring-offset-2 focus-visible:ring-offset-black',
              )}
            >
              <div className="h-[42px] w-[42px] rounded-[50%] bg-white" />
              {photos.length === 0 && (
                <div
                  aria-hidden="true"
                  className="absolute -inset-1 rounded-[50%] ring-[3px] ring-[var(--accent)]"
                />
              )}
            </button>

            <button
              type="button"
              onClick={handleDone}
              className={cn(
                focusRing,
                'w-[54px] text-[13px] font-semibold text-white hover:text-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
              )}
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function CapturePage() {
  const [searchParams] = useSearchParams();
  const binIdParam = searchParams.get('binId');
  const mode = resolveCaptureMode(binIdParam);

  if (mode === 'bulk-group') {
    return <CapturePageBulkGroup />;
  }

  return <CapturePageLegacy binId={binIdParam ?? undefined} />;
}
