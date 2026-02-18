import { useRef } from 'react';
import { Camera, X, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AreaPicker } from '@/features/areas/AreaPicker';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import type { BulkAddPhoto, BulkAddAction } from './useBulkAdd';
import { createBulkAddPhoto } from './useBulkAdd';

const MAX_PHOTOS = 20;

interface BulkAddUploadStepProps {
  photos: BulkAddPhoto[];
  sharedAreaId: string | null;
  dispatch: React.Dispatch<BulkAddAction>;
}

export function BulkAddUploadStep({ photos, sharedAreaId, dispatch }: BulkAddUploadStepProps) {
  const t = useTerminology();
  const { activeLocationId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remaining = MAX_PHOTOS - photos.length;
    const newFiles = Array.from(files).slice(0, remaining);
    if (newFiles.length === 0) return;
    const newPhotos = newFiles.map((f) => createBulkAddPhoto(f, sharedAreaId));
    dispatch({ type: 'ADD_PHOTOS', photos: newPhotos });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleRemove(id: string) {
    const photo = photos.find((p) => p.id === id);
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    dispatch({ type: 'REMOVE_PHOTO', id });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-bold text-[var(--text-primary)]">Upload Photos</h2>
        <p className="text-[15px] text-[var(--text-secondary)] mt-1">
          Add a photo for each {t.bin} you want to create.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--border)] py-16 text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          <ImagePlus className="h-10 w-10" />
          <span className="text-[15px] font-medium">Select photos</span>
          <span className="text-[13px]">One photo per {t.bin}, up to {MAX_PHOTOS}</span>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative aspect-square group">
                <img
                  src={photo.previewUrl}
                  alt="Preview"
                  className="h-full w-full rounded-[var(--radius-md)] object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemove(photo.id)}
                  className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center shadow-sm hover:bg-[var(--destructive)] hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square flex flex-col items-center justify-center gap-1.5 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                <Camera className="h-5 w-5" />
                <span className="text-[11px]">Add more</span>
              </button>
            )}
          </div>

          {photos.length >= MAX_PHOTOS && (
            <p className="text-[13px] text-amber-500">Maximum of {MAX_PHOTOS} photos reached.</p>
          )}

          <div className="space-y-2">
            <Label>{t.Area} for all {t.bins} (optional)</Label>
            <AreaPicker
              locationId={activeLocationId ?? undefined}
              value={sharedAreaId}
              onChange={(areaId) => dispatch({ type: 'SET_SHARED_AREA', areaId })}
            />
            <p className="text-[12px] text-[var(--text-tertiary)]">
              Applied to all new {t.bins}. You can change this per {t.bin} during review.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => dispatch({ type: 'GO_TO_REVIEW' })}
          disabled={photos.length === 0}
          className="rounded-[var(--radius-full)]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
