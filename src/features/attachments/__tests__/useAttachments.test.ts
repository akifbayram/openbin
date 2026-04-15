import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ token: 'cookie' }),
}));

import { apiFetch } from '@/lib/api';
import { deleteAttachment, getAttachmentDownloadUrl, uploadAttachment } from '../useAttachments';

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('uploadAttachment', () => {
  it('sends FormData with the file field to the bin-scoped endpoint', async () => {
    mockApiFetch.mockResolvedValue({ id: 'ATT001' });

    const file = new File(['%PDF-1.4'], 'spec.pdf', { type: 'application/pdf' });
    const id = await uploadAttachment('BIN123', file);

    expect(id).toBe('ATT001');
    expect(mockApiFetch).toHaveBeenCalledWith('/api/bins/BIN123/attachments', {
      method: 'POST',
      body: expect.any(FormData),
    });
    const call = mockApiFetch.mock.calls[0];
    const body = (call[1] as { body: FormData }).body;
    expect(body.get('file')).toBe(file);
  });
});

describe('deleteAttachment', () => {
  it('DELETEs the attachment endpoint', async () => {
    mockApiFetch.mockResolvedValue({ message: 'Attachment deleted' });
    await deleteAttachment('ATT001');
    expect(mockApiFetch).toHaveBeenCalledWith('/api/attachments/ATT001', { method: 'DELETE' });
  });
});

describe('getAttachmentDownloadUrl', () => {
  it('returns the file endpoint URL', () => {
    expect(getAttachmentDownloadUrl('ATT001')).toBe('/api/attachments/ATT001/file');
  });
});
