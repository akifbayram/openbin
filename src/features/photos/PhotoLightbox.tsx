import { useEffect, useRef } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PhotoLightboxProps {
  src: string;
  filename: string;
  onClose: () => void;
  onDelete: () => void;
}

export function PhotoLightbox({ src, filename, onClose, onDelete }: PhotoLightboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-[70] flex flex-col items-center w-full max-w-3xl px-4">
        <div className="absolute top-2 right-4 flex gap-2 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label="Delete photo"
            className="rounded-full h-10 w-10 bg-black/40 text-white hover:bg-black/60 hover:text-red-400"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full h-10 w-10 bg-black/40 text-white hover:bg-black/60"
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
