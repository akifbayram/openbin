import { Paperclip } from 'lucide-react';
import { useId } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { UpgradePrompt } from '@/ee/UpgradePrompt';
import { AttachmentsList } from '@/features/attachments/AttachmentsList';
import { useAttachments } from '@/features/attachments/useAttachments';
import { PhotoGallery } from '@/features/photos/PhotoGallery';
import { isAttachmentsEnabled } from '@/lib/qrConfig';
import { usePlan } from '@/lib/usePlan';
import { categoryHeader } from '@/lib/utils';
import type { Photo } from '@/types';

interface BinDetailFilesTabProps {
  binId: string;
  photos: Photo[];
  canEdit: boolean;
}

export function BinDetailFilesTab({ binId, photos, canEdit }: BinDetailFilesTabProps) {
  const attachmentsOn = isAttachmentsEnabled();
  const { planInfo, isGated } = usePlan();
  const attachmentsGated = isGated('attachments');
  const { attachments } = useAttachments(attachmentsOn ? binId : undefined);
  const showPhotos = canEdit || photos.length > 0;
  const showAttachments = attachmentsOn && (canEdit || attachments.length > 0);
  const showSectionLabels = showPhotos && showAttachments;
  const idPrefix = useId();
  const photosLabelId = `${idPrefix}-photos`;
  const docsLabelId = `${idPrefix}-documents`;

  if (!showPhotos && !showAttachments) {
    return (
      <EmptyState
        icon={Paperclip}
        title="No files"
        subtitle="Photos and attachments added to this bin will appear here."
        compact
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {showPhotos && (
        <section aria-labelledby={showSectionLabels ? photosLabelId : undefined}>
          {showSectionLabels && (
            <h3 id={photosLabelId} className={`${categoryHeader} mb-2.5`}>
              Photos
            </h3>
          )}
          <PhotoGallery binId={binId} variant="inline" />
        </section>
      )}
      {showAttachments && (
        <section aria-labelledby={showSectionLabels ? docsLabelId : undefined} className="flex flex-col gap-3">
          {showSectionLabels && (
            <h3 id={docsLabelId} className={categoryHeader}>
              Documents
            </h3>
          )}
          {attachmentsGated && canEdit && (
            <UpgradePrompt
              feature="Document Attachments"
              description="Upload PDFs, spreadsheets, and other files to bins."
              upgradeUrl={planInfo.upgradeUrl}
            />
          )}
          <AttachmentsList
            binId={binId}
            attachments={attachments}
            canUpload={canEdit && !attachmentsGated}
            canDelete={canEdit}
          />
        </section>
      )}
    </div>
  );
}
