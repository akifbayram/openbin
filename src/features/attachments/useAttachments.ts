import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Events, notify } from '@/lib/eventBus';
import { useListData } from '@/lib/useListData';
import type { Attachment } from '@/types';

export const notifyAttachmentsChanged = () => notify(Events.ATTACHMENTS);

export function useAttachments(binId: string | undefined) {
  const { token } = useAuth();
  const { data: attachments, isLoading, refresh } = useListData<Attachment>(
    binId && token ? `/api/bins/${encodeURIComponent(binId)}/attachments` : null,
    [Events.ATTACHMENTS],
  );
  return { attachments, isLoading, refresh };
}

export function getAttachmentDownloadUrl(attachmentId: string): string {
  return `/api/attachments/${attachmentId}/file`;
}

export async function uploadAttachment(binId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const result = await apiFetch<{ id: string }>(`/api/bins/${binId}/attachments`, {
    method: 'POST',
    body: formData,
  });
  notifyAttachmentsChanged();
  return result.id;
}

export async function deleteAttachment(id: string): Promise<void> {
  await apiFetch<{ message: string }>(`/api/attachments/${id}`, {
    method: 'DELETE',
  });
  notifyAttachmentsChanged();
}
