import { X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PhotoLightboxProps {
  src: string;
  filename: string;
  onClose: () => void;
  onDelete: () => void;
}

export function PhotoLightbox({ src, filename, onClose, onDelete }: PhotoLightboxProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
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
            className="rounded-full h-10 w-10 bg-black/40 text-white hover:bg-black/60 hover:text-red-400"
            title="Delete photo"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full h-10 w-10 bg-black/40 text-white hover:bg-black/60"
            title="Close"
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
