import { Camera, Loader2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MAX_AI_PHOTOS } from '@/features/ai/useAiAnalysis';
import { cn } from '@/lib/utils';

interface PhotoUploadSectionProps {
  isFull: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  photos: File[];
  photoPreviews: string[];
  onPhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (index: number) => void;
  onAnalyze: () => void;
  analyzing: boolean;
  analyzeError: string | null;
  aiEnabled: boolean;
}

export function PhotoUploadSection({
  isFull,
  fileInputRef,
  photos,
  photoPreviews,
  onPhotoSelect,
  onRemovePhoto,
  onAnalyze,
  analyzing,
  analyzeError,
  aiEnabled,
}: PhotoUploadSectionProps) {
  return (
    <div className={cn(isFull ? 'space-y-2' : 'text-left')}>
      {isFull && <Label>Photos</Label>}
      <input
        ref={fileInputRef as React.RefObject<HTMLInputElement>}
        type="file"
        accept={isFull ? 'image/*' : 'image/jpeg,image/png,image/webp,image/gif'}
        {...(!isFull && { capture: 'environment' as const })}
        multiple
        className="hidden"
        onChange={onPhotoSelect}
      />
      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed text-[14px] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]',
            isFull
              ? 'border-[var(--border)] py-4 text-[var(--text-tertiary)]'
              : 'border-[var(--border-primary)] py-3 text-[var(--text-tertiary)]'
          )}
        >
          <Camera className={cn(isFull ? 'h-5 w-5' : 'h-4 w-4')} />
          Add Photo
        </button>
      ) : (
        <div className="space-y-2">
          <div className={cn(
            'flex items-center gap-2 overflow-x-auto',
            !isFull && 'rounded-[var(--radius-md)] bg-[var(--bg-input)] p-2'
          )}>
            {photoPreviews.map((preview, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: preview blobs have no stable identity
              <div key={i} className="relative shrink-0">
                <img
                  src={preview}
                  alt={`Preview ${i + 1}`}
                  className={cn(
                    'h-14 w-14 object-cover',
                    isFull ? 'rounded-[var(--radius-md)]' : 'rounded-[var(--radius-sm)]'
                  )}
                />
                <button
                  type="button"
                  onClick={() => onRemovePhoto(i)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center shadow-sm hover:bg-[var(--destructive)] hover:text-white transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {photos.length < MAX_AI_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'h-14 w-14 shrink-0 flex items-center justify-center border-2 border-dashed border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors',
                  isFull ? 'rounded-[var(--radius-md)]' : 'rounded-[var(--radius-sm)]'
                )}
              >
                <Camera className="h-4 w-4" />
              </button>
            )}
          </div>
          {isFull ? (
            aiEnabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onAnalyze}
                disabled={analyzing}
                className="gap-1.5"
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 text-[var(--ai-accent)]" />
                )}
                {analyzing ? 'Analyzing...' : `Analyze with AI${photos.length > 1 ? ` (${photos.length})` : ''}`}
              </Button>
            )
          ) : (
            <button
              type="button"
              onClick={onAnalyze}
              disabled={analyzing}
              className="flex items-center gap-1.5 text-[13px] text-[var(--ai-accent)] hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {analyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {analyzing ? 'Analyzing...' : `Analyze with AI${photos.length > 1 ? ` (${photos.length})` : ''}`}
            </button>
          )}
        </div>
      )}
      {analyzeError && (
        <p className={cn('text-[var(--destructive)]', isFull ? 'text-[13px]' : 'text-[12px] mt-1')}>{analyzeError}</p>
      )}
    </div>
  );
}
