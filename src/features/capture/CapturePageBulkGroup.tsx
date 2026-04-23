import { Camera, Check, Images, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn, focusRing } from '@/lib/utils';
import { setCapturedPhotos, setCapturedReturnTarget } from './capturedPhotos';
import { FirstRunCoachmark, HelpButton } from './guidance/CameraGuidance';
import { useCaptureGrouping } from './useCaptureGrouping';

const LONG_PRESS_MS = 500;

function viewfinderHint(currentGroup: number, photosInCurrentGroup: number): string {
  if (currentGroup === 0 && photosInCurrentGroup === 0) return 'tap shutter to capture';
  if (currentGroup === 0 && photosInCurrentGroup > 0) return 'keep shooting — same bin';
  if (currentGroup > 0 && photosInCurrentGroup === 0) return 'new bin — aim & shoot';
  return 'Done when finished';
}

function ThumbnailItem({
  photo,
  groupIdx,
  photoIdx,
  onRemove,
}: {
  photo: { id: string; thumbnailUrl: string };
  groupIdx: number;
  photoIdx: number;
  onRemove: (id: string) => void;
}) {
  const [showRemove, setShowRemove] = useState(false);
  const timerRef = useRef<number | null>(null);
  const liRef = useRef<HTMLLIElement>(null);

  function start() {
    timerRef.current = window.setTimeout(() => setShowRemove(true), LONG_PRESS_MS);
  }
  function cancel() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  // Dismiss the remove overlay when the user taps outside this thumbnail.
  useEffect(() => {
    if (!showRemove) return;
    function handlePointerDown(e: PointerEvent) {
      if (liRef.current && !liRef.current.contains(e.target as Node)) {
        setShowRemove(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showRemove]);

  // Clear any pending long-press timer if the component unmounts mid-press.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <li
      ref={liRef}
      aria-label={`Bin ${groupIdx + 1}, photo ${photoIdx + 1}`}
      className="h-11 w-11 flex-shrink-0 relative"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowRemove(true);
      }}
    >
      <img
        src={photo.thumbnailUrl}
        alt=""
        className="h-full w-full rounded-[var(--radius-sm)] object-cover"
      />
      {showRemove && (
        <button
          type="button"
          onClick={() => {
            setShowRemove(false);
            onRemove(photo.id);
          }}
          aria-label="Remove photo"
          className={cn(
            focusRing,
            'absolute inset-0 flex items-center justify-center bg-black/60 rounded-[var(--radius-sm)] focus-visible:ring-offset-2 focus-visible:ring-offset-black',
          )}
        >
          <X className="h-4 w-4 text-white" />
        </button>
      )}
    </li>
  );
}

export function CapturePageBulkGroup() {
  const navigate = useNavigate();
  const {
    videoRef,
    isStreaming,
    error,
    photos,
    currentGroup,
    photosInCurrentGroup,
    groups,
    importFiles,
    capture,
    nextGroup,
    removePhoto,
    startCamera,
    cleanup,
  } = useCaptureGrouping();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => cleanup, [cleanup]);

  function handleClose() {
    if (photos.length > 0) {
      const ok = window.confirm(`Discard ${photos.length} photo${photos.length === 1 ? '' : 's'}?`);
      if (!ok) return;
    }
    navigate(-1);
  }

  function handleLibrary() {
    fileInputRef.current?.click();
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    importFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDone() {
    if (photos.length === 0) return;
    const files: File[] = [];
    const groupIds: number[] = [];
    photos.forEach((p, i) => {
      files.push(new File([p.blob], `capture-${i + 1}.jpg`, { type: 'image/jpeg' }));
      groupIds.push(p.groupId ?? currentGroup);
    });
    setCapturedPhotos(files, groupIds);
    setCapturedReturnTarget('bulk-add');
    navigate(-1);
  }

  const photoLabel = photosInCurrentGroup === 1 ? 'photo' : 'photos';
  const hasCamera = !!navigator.mediaDevices?.getUserMedia;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Video element — always rendered so ref is available when startCamera fires */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {!isStreaming && (
        <div className="absolute inset-0 z-20 flex flex-col bg-[var(--bg-base)] items-center justify-center gap-5 px-6">
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
              Bin #{currentGroup + 1} · {photosInCurrentGroup} {photoLabel}
            </div>

            <div className="flex items-center gap-2">
              <HelpButton className="bg-transparent hover:bg-white/10" />
              <button
                type="button"
                onClick={handleLibrary}
                className={cn(
                  focusRing,
                  'h-8 w-8 flex items-center justify-center text-white/90 hover:text-white focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                )}
                aria-label="Open photo library"
              >
                <Images className="h-5 w-5" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* Viewfinder */}
          <div className="flex-1 relative flex items-center justify-center">
            <div className="absolute inset-4 border border-dashed border-white/40 pointer-events-none">
              <div className="absolute -top-px -left-px h-4 w-4 border-t-2 border-l-2 border-[var(--accent)]" />
              <div className="absolute -top-px -right-px h-4 w-4 border-t-2 border-r-2 border-[var(--accent)]" />
              <div className="absolute -bottom-px -left-px h-4 w-4 border-b-2 border-l-2 border-[var(--accent)]" />
              <div className="absolute -bottom-px -right-px h-4 w-4 border-b-2 border-r-2 border-[var(--accent)]" />
            </div>
            <p className="relative text-[13px] text-white/55 font-medium text-center px-6">
              {viewfinderHint(currentGroup, photosInCurrentGroup)}
            </p>
          </div>
          {/* Photo strip */}
          <div
            className="relative z-10 bg-black/50 overflow-x-auto overflow-y-hidden"
            style={{ minHeight: 56 }}
          >
            {photos.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-white/40 italic">
                No photos yet
              </div>
            ) : (
              /* Outer wrapper is <div> not <ul>: groups are visual clusters; only photo <li>s are listitems */
              <div className="flex items-center gap-0 px-3 py-2">
                {groups.map((group, groupIdx) => (
                  <div key={group.id} className="flex items-center">
                    <ul className="flex items-center gap-[2px]">
                      {group.photos.map((photo, photoIdx) => (
                        <ThumbnailItem
                          key={photo.id}
                          photo={photo}
                          groupIdx={groupIdx}
                          photoIdx={photoIdx}
                          onRemove={removePhoto}
                        />
                      ))}
                    </ul>
                    {groupIdx < groups.length - 1 && (
                      <div
                        data-testid={`group-divider-${group.id}-${groups[groupIdx + 1].id}`}
                        className="mx-1 h-9 w-[2px] rounded-[1px] bg-[var(--accent)]"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom controls */}
          <div
            className="relative z-10 flex items-center justify-between px-4 pt-2 pb-4 bg-black/50"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
          >
            <button
              type="button"
              disabled={photos.length === 0}
              onClick={handleDone}
              aria-label="Done"
              className={cn(
                focusRing,
                'w-[54px] text-[13px] focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                photos.length === 0
                  ? 'font-medium text-white/35 cursor-not-allowed'
                  : 'font-semibold text-white hover:text-white/90',
              )}
            >
              Done
            </button>

            <button
              type="button"
              onClick={capture}
              aria-label="Take photo"
              className={cn(
                focusRing,
                'h-[54px] w-[54px] rounded-[50%] border-[3px] border-white flex items-center justify-center active:scale-95 transition-transform relative focus-visible:ring-offset-2 focus-visible:ring-offset-black',
              )}
            >
              <div className="h-[42px] w-[42px] rounded-[50%] bg-white" />
              {photosInCurrentGroup === 0 && (
                <div
                  aria-hidden="true"
                  className="absolute -inset-1 rounded-[50%] ring-[3px] ring-[var(--accent)]"
                />
              )}
            </button>

            <button
              type="button"
              disabled={photosInCurrentGroup === 0}
              onClick={nextGroup}
              aria-label="Next bin"
              className={cn(
                focusRing,
                'w-[54px] text-[9px] leading-[1.1] flex flex-col items-center gap-[1px] focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                photosInCurrentGroup === 0
                  ? 'text-white/35 cursor-not-allowed'
                  : 'text-[var(--accent)] font-semibold hover:brightness-125',
              )}
            >
              <Check className="h-3 w-3" aria-hidden="true" />
              <span>Next</span>
              <span>bin</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
