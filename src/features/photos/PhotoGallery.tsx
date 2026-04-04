import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { cn, getErrorMessage } from '@/lib/utils';
import type { Photo } from '@/types';
import { compressImage } from './compressImage';
import { DeletePhotoDialog } from './DeletePhotoDialog';
import { PhotoLightbox } from './PhotoLightbox';
import { addPhoto, deletePhoto, getPhotoThumbUrl, notifyPhotosChanged, usePhotos } from './usePhotos';

const UPLOAD_CONCURRENCY = 3;

interface PhotoGalleryProps {
  binId: string;
  variant?: 'card' | 'inline';
}

export function PhotoGallery({ binId, variant = 'card' }: PhotoGalleryProps) {
  const { photos } = usePhotos(binId);
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setUploadingCount(imageFiles.length);
    let errorCount = 0;

    // Process uploads with bounded concurrency
    const queue = [...imageFiles];
    const uploadOne = async () => {
      let file = queue.shift();
      while (file) {
        try {
          const compressed = await compressImage(file);
          const compressedFile = new File([compressed], file.name, { type: compressed.type });
          await addPhoto(binId, compressedFile, { silent: true });
        } catch {
          errorCount++;
        } finally {
          setUploadingCount((c) => c - 1);
        }
        file = queue.shift();
      }
    };

    const workers = Array.from(
      { length: Math.min(UPLOAD_CONCURRENCY, imageFiles.length) },
      () => uploadOne(),
    );
    await Promise.all(workers);

    notifyPhotosChanged();
    if (errorCount > 0) {
      showToast({
        message: `Failed to upload ${errorCount} photo${errorCount > 1 ? 's' : ''}`,
        variant: 'error',
      });
    }
    if (inputRef.current) inputRef.current.value = '';
  }, [binId, showToast]);

  const handleDelete = useCallback(async (photo: Photo) => {
    try {
      await deletePhoto(photo.id);
      showToast({ message: 'Deleted photo', variant: 'success' });
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to delete photo'), variant: 'error' });
    }
  }, [showToast]);

  const content = (
    <>
      {variant !== 'inline' && <Label>Photos</Label>}
      <div className={cn('flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory', variant !== 'inline' && 'mt-2.5')}>
        {photos.map((photo, index) => (
          <div key={photo.id} className="relative group flex-shrink-0">
            <button
              type="button"
              onClick={() => setLightboxIndex(index)}
              aria-label={`View ${photo.filename}`}
              className="block w-20 h-20 rounded-[var(--radius-sm)] overflow-hidden bg-[var(--bg-input)] snap-start"
            >
              <img
                src={getPhotoThumbUrl(photo.id)}
                alt={photo.filename}
                className="w-full h-full object-cover"
              />
            </button>
            <Tooltip content="Delete photo">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPhotoToDelete(photo)}
                className="absolute top-1 right-1 h-8 w-8 rounded-[var(--radius-xs)] bg-[var(--overlay-button)] text-white opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity hover:bg-[var(--overlay-button-hover)] hover:text-[var(--destructive)]"
                aria-label="Delete photo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          </div>
        ))}
        {uploadingCount > 0 && Array.from({ length: uploadingCount }, (_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: identical stateless placeholders
            key={i}
            className="flex items-center justify-center w-20 h-20 flex-shrink-0 rounded-[var(--radius-sm)] bg-[var(--bg-input)] snap-start"
          >
            <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
          </div>
        ))}
        {/* Add photo button */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Add photo"
          className="flex flex-col items-center justify-center w-20 h-20 flex-shrink-0 rounded-[var(--radius-sm)] border-2 border-dashed border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors snap-start"
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
      {lightboxIndex !== null && photos.length > 0 && (
        <PhotoLightbox
          photos={photos}
          initialIndex={Math.min(lightboxIndex, photos.length - 1)}
          onClose={() => setLightboxIndex(null)}
          onDelete={(photo) => setPhotoToDelete(photo)}
        />
      )}
      <DeletePhotoDialog
        open={photoToDelete !== null}
        onOpenChange={(open) => { if (!open) setPhotoToDelete(null); }}
        onConfirm={() => {
          if (photoToDelete) handleDelete(photoToDelete);
          setPhotoToDelete(null);
        }}
      />
    </>
  );

  if (variant === 'inline') return <div>{content}</div>;

  return (
    <Card>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
