import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PhotoLightboxProps {
  src: string;
  filename: string;
  onClose: () => void;
  onDelete: () => void;
}

export function PhotoLightbox({ src, filename, onClose, onDelete }: PhotoLightboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [animating, setAnimating] = useState<'enter' | 'exit' | null>(null);
  const [prefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    requestAnimationFrame(() => setAnimating('enter'));
  }, []);

  useEffect(() => {
    containerRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(() => {
    if (prefersReducedMotion) {
      onClose();
      return;
    }
    setAnimating('exit');
    setTimeout(onClose, 200);
  }, [onClose, prefersReducedMotion]);

  const show = animating === 'enter';
  const duration = prefersReducedMotion ? 'duration-0' : 'duration-200';

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo: ${filename}`}
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex items-center justify-center outline-none"
    >
      <div
        className={cn(
          'fixed inset-0 bg-[var(--overlay-heavy)] backdrop-blur-sm transition-opacity',
          duration,
          show ? 'opacity-100' : 'opacity-0',
        )}
        onClick={handleClose}
      />
      <div
        className={cn(
          'relative z-[70] flex flex-col items-center w-full max-w-3xl px-4 transition-all',
          duration,
          show ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
        )}
      >
        <div className="absolute top-2 right-4 flex gap-2 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label="Delete photo"
            className="rounded-full h-10 w-10 bg-[var(--overlay-button)] text-white hover:bg-[var(--overlay-button-hover)] hover:text-red-400"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            aria-label="Close"
            className="rounded-full h-10 w-10 bg-[var(--overlay-button)] text-white hover:bg-[var(--overlay-button-hover)]"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <img
          src={src}
          alt={filename}
          className="max-h-[80vh] max-w-full rounded-[var(--radius-lg)] object-contain"
        />
      </div>
    </div>
  );
}
