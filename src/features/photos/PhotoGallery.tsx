import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { cn, focusRing, getErrorMessage } from '@/lib/utils';
import type { Photo } from '@/types';
import { compressImage } from './compressImage';
import { DeletePhotoDialog } from './DeletePhotoDialog';
import { PhotoLightbox } from './PhotoLightbox';
import { addPhoto, deletePhoto, getPhotoThumbUrl, notifyPhotosChanged, usePhotos } from './usePhotos';

const UPLOAD_CONCURRENCY = 3;

// Must stay in sync with PHOTO_MIME_TYPES in server/src/lib/uploadConfig.ts.
const ACCEPTED_PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const ACCEPTED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ACCEPT_PHOTO_ATTR = [...ACCEPTED_PHOTO_EXTENSIONS, ...ACCEPTED_PHOTO_MIME_TYPES].join(',');
const ACCEPTED_PHOTO_EXT_SET = new Set(ACCEPTED_PHOTO_EXTENSIONS);
const ACCEPTED_PHOTO_MIME_SET = new Set(ACCEPTED_PHOTO_MIME_TYPES);
const ACCEPTED_PHOTO_HINT = 'JPEG, PNG, WebP, GIF';

function isAcceptedPhoto(file: File): boolean {
  if (file.type && ACCEPTED_PHOTO_MIME_SET.has(file.type)) return true;
  const idx = file.name.lastIndexOf('.');
  if (idx <= 0) return false;
  return ACCEPTED_PHOTO_EXT_SET.has(file.name.slice(idx).toLowerCase());
}

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
    const rejected: string[] = [];
    const imageFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (isAcceptedPhoto(file)) {
        imageFiles.push(file);
      } else {
        rejected.push(file.name);
      }
    }
    if (rejected.length > 0) {
      showToast({
        message: `${rejected.length === 1 ? `"${rejected[0]}" is not a supported image type` : `${rejected.length} files have unsupported types`}. Allowed: ${ACCEPTED_PHOTO_HINT}.`,
        variant: 'error',
      });
    }
    if (imageFiles.length === 0) {
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

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
              className={cn(
                'block w-20 h-20 rounded-[var(--radius-sm)] overflow-hidden bg-[var(--bg-input)] snap-start',
                focusRing,
              )}
            >
              <img
                src={getPhotoThumbUrl(photo.id)}
                alt={photo.filename}
                loading="lazy"
                decoding="async"
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
          <output
            // biome-ignore lint/suspicious/noArrayIndexKey: identical stateless placeholders
            key={i}
            aria-live="polite"
            className="flex items-center justify-center w-20 h-20 flex-shrink-0 rounded-[var(--radius-sm)] bg-[var(--bg-input)] snap-start"
          >
            <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" aria-hidden="true" />
          </output>
        ))}
        {/* Add photo button */}
        <Tooltip content={ACCEPTED_PHOTO_HINT}>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label={`Add photo. Allowed types: ${ACCEPTED_PHOTO_HINT}.`}
            className={cn(
              'flex flex-col items-center justify-center w-20 h-20 flex-shrink-0 rounded-[var(--radius-sm)] border-2 border-dashed border-[var(--border-subtle)] text-[var(--text-tertiary)] transition-colors duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] snap-start',
              focusRing,
            )}
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span className="mt-0.5 text-[11px] font-medium">Add Photo</span>
          </button>
        </Tooltip>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_PHOTO_ATTR}
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
