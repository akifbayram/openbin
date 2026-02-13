import { useRef, useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { usePhotos, addPhoto, deletePhoto, getPhotoUrl } from './usePhotos';
import { compressImage } from './compressImage';
import { PhotoLightbox } from './PhotoLightbox';
import type { Photo } from '@/types';

interface PhotoGalleryProps {
  binId: string;
  variant?: 'card' | 'inline';
}

export function PhotoGallery({ binId, variant = 'card' }: PhotoGalleryProps) {
  const { photos } = usePhotos(binId);
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const compressed = await compressImage(file);
        const compressedFile = new File([compressed], file.name, { type: compressed.type });
        await addPhoto(binId, compressedFile);
      } catch (err) {
        showToast({
          message: err instanceof Error ? err.message : 'Failed to add photo',
        });
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  }, [binId, showToast]);

  const handleDelete = useCallback(async (photo: Photo) => {
    await deletePhoto(photo.id);
    setLightboxPhoto(null);
    showToast({ message: 'Deleted photo' });
  }, [showToast]);

  const lightboxUrl = lightboxPhoto ? getPhotoUrl(lightboxPhoto.id) : undefined;

  const content = (
    <>
      {variant !== 'inline' && <Label>Photos</Label>}
      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2${variant !== 'inline' ? ' mt-2.5' : ''}`}>
        {photos.map((photo) => (
          <div key={photo.id} className="relative group">
            <button
              type="button"
              onClick={() => setLightboxPhoto(photo)}
              aria-label={`View ${photo.filename}`}
              className="block w-full aspect-square rounded-[var(--radius-sm)] overflow-hidden bg-[var(--bg-input)]"
            >
              <img
                src={getPhotoUrl(photo.id)}
                alt={photo.filename}
                className="w-full h-full object-cover"
              />
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(photo)}
              className="absolute top-1 right-1 h-7 w-7 rounded-full bg-[var(--overlay-button)] text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--overlay-button-hover)] hover:text-red-400"
              aria-label="Delete photo"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {/* Add photo button */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Add photo"
          className="flex flex-col items-center justify-center aspect-square rounded-[var(--radius-sm)] border-2 border-dashed border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          <Plus className="h-6 w-6" />
          <span className="text-[11px] mt-1 font-medium">Add Photo</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {lightboxPhoto && lightboxUrl && (
        <PhotoLightbox
          src={lightboxUrl}
          filename={lightboxPhoto.filename}
          onClose={() => setLightboxPhoto(null)}
          onDelete={() => handleDelete(lightboxPhoto)}
        />
      )}
    </>
  );

  if (variant === 'inline') return <div>{content}</div>;

  return (
    <Card>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
