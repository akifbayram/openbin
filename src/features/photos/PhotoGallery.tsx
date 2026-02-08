import { useRef, useState, useEffect, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { usePhotos, addPhoto, deletePhoto, restorePhoto } from './usePhotos';
import { compressImage } from './compressImage';
import { PhotoLightbox } from './PhotoLightbox';
import type { Photo } from '@/types';

interface PhotoGalleryProps {
  binId: string;
}

export function PhotoGallery({ binId }: PhotoGalleryProps) {
  const photos = usePhotos(binId);
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);

  // Manage object URLs with proper cleanup
  const urls = useMemo(() => {
    if (!photos) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const p of photos) {
      map.set(p.id, URL.createObjectURL(p.data));
    }
    return map;
  }, [photos]);

  useEffect(() => {
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [urls]);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const compressed = await compressImage(file);
        await addPhoto(binId, compressed, file.name);
      } catch (err) {
        showToast({
          message: err instanceof Error ? err.message : 'Failed to add photo',
        });
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleDelete(photo: Photo) {
    const snapshot = await deletePhoto(photo.id);
    setLightboxPhoto(null);
    if (snapshot) {
      showToast({
        message: `Deleted photo`,
        action: {
          label: 'Undo',
          onClick: () => restorePhoto(snapshot),
        },
      });
    }
  }

  const lightboxUrl = lightboxPhoto ? urls.get(lightboxPhoto.id) : undefined;

  return (
    <Card>
      <CardContent>
        <Label>Photos</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2.5">
          {photos?.map((photo) => {
            const url = urls.get(photo.id);
            if (!url) return null;
            return (
              <div key={photo.id} className="relative group">
                <button
                  type="button"
                  onClick={() => setLightboxPhoto(photo)}
                  className="block w-full aspect-square rounded-[var(--radius-sm)] overflow-hidden bg-[var(--bg-input)]"
                >
                  <img
                    src={url}
                    alt={photo.filename}
                    className="w-full h-full object-cover"
                  />
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(photo)}
                  className="absolute top-1 right-1 h-7 w-7 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 hover:text-red-400"
                  title="Delete photo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
          {/* Add photo button */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
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
      </CardContent>

      {lightboxPhoto && lightboxUrl && (
        <PhotoLightbox
          src={lightboxUrl}
          filename={lightboxPhoto.filename}
          onClose={() => setLightboxPhoto(null)}
          onDelete={() => handleDelete(lightboxPhoto)}
        />
      )}
    </Card>
  );
}
