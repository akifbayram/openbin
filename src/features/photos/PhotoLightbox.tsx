import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Photo } from '@/types';
import { getPhotoUrl } from './usePhotos';

interface PhotoLightboxProps {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
  onDelete: (photo: Photo) => void;
}

const SWIPE_THRESHOLD = 50;

export function PhotoLightbox({ photos, initialIndex, onClose, onDelete }: PhotoLightboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [animating, setAnimating] = useState<'enter' | 'exit' | null>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [prefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  // Swipe tracking
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const isSwiping = useRef(false);

  const photo = photos[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;
  const showNav = photos.length > 1;

  useEffect(() => {
    requestAnimationFrame(() => setAnimating('enter'));
  }, []);

  const handleClose = useCallback(() => {
    if (prefersReducedMotion) {
      onClose();
      return;
    }
    setAnimating('exit');
    setTimeout(onClose, 200);
  }, [onClose, prefersReducedMotion]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(photos.length - 1, i + 1));
  }, [photos.length]);

  // Re-focus container when it should be the active modal (e.g. after delete dialog closes)
  useEffect(() => {
    if (animating !== 'exit') {
      containerRef.current?.focus();
    }
  }, [animating, currentIndex, photos.length]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'Escape':
          handleClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goNext();
          break;
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, goPrev, goNext]);

  // Touch swipe handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 1) return;
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    isSwiping.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 1) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(touchDeltaX.current) > 10) {
      isSwiping.current = true;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!isSwiping.current) return;
    if (touchDeltaX.current > SWIPE_THRESHOLD) {
      goPrev();
    } else if (touchDeltaX.current < -SWIPE_THRESHOLD) {
      goNext();
    }
    isSwiping.current = false;
  }, [goPrev, goNext]);

  // Keep index in bounds if a photo is deleted
  useEffect(() => {
    if (photos.length === 0) {
      handleClose();
    } else if (currentIndex >= photos.length) {
      setCurrentIndex(photos.length - 1);
    }
  }, [photos.length, currentIndex, handleClose]);

  if (!photo) return null;

  const show = animating === 'enter';
  const duration = prefersReducedMotion ? 'duration-0' : 'duration-200';

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${currentIndex + 1} of ${photos.length}: ${photo.filename}`}
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex items-center justify-center outline-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Backdrop */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay dismisses lightbox on click */}
      <div
        role="presentation"
        className={cn(
          'fixed inset-0 bg-[var(--overlay-heavy)] backdrop-blur-sm transition-opacity',
          duration,
          show ? 'opacity-100' : 'opacity-0',
        )}
        onClick={handleClose}
      />

      {/* Content */}
      <div
        className={cn(
          'relative z-[70] flex flex-col items-center w-full max-w-3xl px-4 transition-all',
          duration,
          show ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
        )}
      >
        {/* Top action bar */}
        <div className="absolute top-2 right-4 flex gap-2 z-10">
          <Tooltip content="Delete photo" side="bottom">
            <Button
              variant="ghost"
              size="sm" px="0"
              onClick={() => onDelete(photo)}
              aria-label="Delete photo"
              height="10"
              width="10"
              className="bg-[var(--overlay-button)] text-white hover:bg-[var(--overlay-button-hover)] hover:text-red-400"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </Tooltip>
          <Tooltip content="Close" side="bottom">
            <Button
              variant="ghost"
              size="sm" px="0"
              onClick={handleClose}
              aria-label="Close"
              height="10"
              width="10"
              className="bg-[var(--overlay-button)] text-white hover:bg-[var(--overlay-button-hover)]"
            >
              <X className="h-5 w-5" />
            </Button>
          </Tooltip>
        </div>

        {/* Image */}
        <img
          src={getPhotoUrl(photo.id)}
          alt={photo.filename}
          className="max-h-[80vh] max-w-full rounded-[var(--radius-lg)] object-contain select-none"
          draggable={false}
        />

        {/* Prev/Next arrow buttons */}
        {showNav && (
          <>
            <Button
              variant="ghost"
              size="sm" px="0"
              onClick={goPrev}
              disabled={!hasPrev}
              aria-label="Previous photo"
              height="10"
              width="10"
              className={cn(
                'absolute left-2 top-1/2 -translate-y-1/2 bg-[var(--overlay-button)] text-white hover:bg-[var(--overlay-button-hover)] transition-opacity',
                !hasPrev && 'opacity-30 pointer-events-none',
              )}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="sm" px="0"
              onClick={goNext}
              disabled={!hasNext}
              aria-label="Next photo"
              height="10"
              width="10"
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2 bg-[var(--overlay-button)] text-white hover:bg-[var(--overlay-button-hover)] transition-opacity',
                !hasNext && 'opacity-30 pointer-events-none',
              )}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}

        {/* Dot indicators */}
        {showNav && (
          <nav className="flex gap-1.5 mt-4" aria-label="Photo navigation">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-current={i === currentIndex ? 'true' : undefined}
                aria-label={`Go to photo ${i + 1}${i === currentIndex ? ' (current)' : ''}`}
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all duration-200',
                  i === currentIndex
                    ? 'bg-white scale-125'
                    : 'bg-white/40 hover:bg-white/60',
                )}
              />
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
