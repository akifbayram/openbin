import { Camera, Check, RotateCcw, SwitchCamera } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CapturePageBulkGroup } from './CapturePageBulkGroup';
import { getCapturedReturnTarget, setCapturedPhotos } from './capturedPhotos';
import type { CapturedPhoto } from './useCapture';
import { useCapture } from './useCapture';

type CaptureMode = 'single-bin' | 'bin-create' | 'bulk-group';

function resolveCaptureMode(
  binId: string | null,
  returnTarget: ReturnType<typeof getCapturedReturnTarget>,
): CaptureMode {
  if (binId) return 'single-bin';
  if (returnTarget === 'bin-create') return 'bin-create';
  return 'bulk-group';
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

  const hasCamera = !!navigator.mediaDevices?.getUserMedia;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Video element — always rendered so ref is available when startCamera fires */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {isStreaming && photos.length > 0 && (
          <div className="absolute top-4 right-4 bg-black/60 px-2.5 py-1 rounded-[var(--radius-md)] text-white text-[13px] font-medium">
            {photos.length} photo{photos.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Overlay: start screen or error (covers video when not streaming) */}
      {!isStreaming && (
        <div className="absolute inset-0 z-10 bg-[var(--bg-base)] flex flex-col items-center justify-center gap-5 px-6">
          {!hasCamera ? (
            <>
              <Camera className="h-16 w-16 text-[var(--text-tertiary)]" />
              <p className="text-[17px] font-semibold text-[var(--text-primary)] text-center">
                Camera not available
              </p>
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
              <p className="text-[17px] font-semibold text-[var(--text-primary)]">
                Ready to capture
              </p>
              <p className="text-[14px] text-[var(--text-secondary)] text-center max-w-sm">
                Tap the button below to start the camera and take photos.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button onClick={() => startCamera()}>Start Camera</Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Bottom controls — only when streaming */}
      {isStreaming && (
        <>
          {/* Thumbnail strip */}
          {photos.length > 0 && (
            <div className="flex gap-1.5 px-3 py-2 overflow-x-auto">
              {photos.map((photo) => (
                <div key={photo.id} className="relative h-12 w-12 flex-shrink-0">
                  <img
                    src={photo.thumbnailUrl}
                    alt=""
                    className="h-full w-full rounded-[var(--radius-sm)] object-cover"
                  />
                  <StatusBadge photo={photo} onRetry={() => retryUpload(photo.id)} />
                </div>
              ))}
            </div>
          )}

          {/* Control bar */}
          <div
            className="flex items-center justify-between px-8 py-4"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
          >
            <button
              type="button"
              onClick={flipCamera}
              className="h-11 w-11 flex items-center justify-center text-white/80 hover:text-white transition-colors"
              aria-label="Flip camera"
            >
              <SwitchCamera className="h-6 w-6" />
            </button>

            <button
              type="button"
              onClick={() => capture()}
              className="h-[68px] w-[68px] rounded-[50%] border-[3px] border-white flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Take photo"
            >
              <div className="h-[56px] w-[56px] rounded-[50%] bg-white" />
            </button>

            <button
              type="button"
              onClick={handleDone}
              className="text-[15px] font-semibold text-white/80 hover:text-white transition-colors"
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
  const mode = resolveCaptureMode(binIdParam, getCapturedReturnTarget());

  if (mode === 'bulk-group') {
    return <CapturePageBulkGroup />;
  }

  return <CapturePageLegacy binId={binIdParam ?? undefined} />;
}
