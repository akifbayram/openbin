import { ImageIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { PhotoGallery } from '@/features/photos/PhotoGallery';
import type { Photo } from '@/types';

interface BinDetailPhotosTabProps {
  binId: string;
  photos: Photo[];
  canEdit: boolean;
}

export function BinDetailPhotosTab({ binId, photos, canEdit }: BinDetailPhotosTabProps) {
  if (photos.length === 0 && !canEdit) {
    return (
      <EmptyState
        icon={ImageIcon}
        title="No photos"
        subtitle="Photos added to this bin will appear here."
        compact
      />
    );
  }
  return <PhotoGallery binId={binId} variant="inline" />;
}
