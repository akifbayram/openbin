import path from 'node:path';
import { Router } from 'express';
import { d, isUniqueViolation, query } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { attachmentStoragePath } from '../lib/attachmentsCleanup.js';
import { requireMemberOrAbove, verifyBinAccess } from '../lib/binAccess.js';
import { ForbiddenError, NotFoundError, QuotaExceededError, ValidationError } from '../lib/httpErrors.js';
import { logRouteActivity } from '../lib/routeHelpers.js';
import { generateShortCode } from '../lib/shortCode.js';
import { storage } from '../lib/storage.js';
import { attachmentUpload, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_SIZE_MB } from '../lib/uploadConfig.js';
import { authenticate } from '../middleware/auth.js';
import { requirePro } from '../middleware/requirePlan.js';

type MemberRole = 'admin' | 'member' | 'viewer';

const router = Router();

router.use(authenticate);

interface AttachmentAccess {
  binId: string;
  binName: string;
  locationId: string;
  storagePath: string;
  mimeType: string;
  filename: string;
  createdBy: string;
  role: MemberRole;
}

async function verifyAttachmentAccess(attachmentId: string, userId: string): Promise<AttachmentAccess | null> {
  const result = await query<{
    bin_id: string;
    bin_name: string;
    storage_path: string;
    mime_type: string;
    filename: string;
    created_by: string;
    location_id: string;
    visibility: string;
    bin_created_by: string;
    role: MemberRole;
  }>(
    `SELECT a.bin_id, b.name AS bin_name, a.storage_path, a.mime_type, a.filename, a.created_by,
            b.location_id, b.visibility, b.created_by AS bin_created_by, lm.role
     FROM attachments a
     JOIN bins b ON b.id = a.bin_id
     JOIN location_members lm ON lm.location_id = b.location_id AND lm.user_id = $2
     WHERE a.id = $1 AND b.deleted_at IS NULL`,
    [attachmentId, userId],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  if (row.visibility === 'private' && row.bin_created_by !== userId) return null;
  return {
    binId: row.bin_id,
    binName: row.bin_name,
    locationId: row.location_id,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    filename: row.filename,
    createdBy: row.created_by,
    role: row.role,
  };
}

router.get('/bins/:id/attachments', asyncHandler(async (req, res) => {
  const binId = req.params.id;
  const access = await verifyBinAccess(binId, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }

  const result = await query(
    `SELECT id, bin_id, filename, mime_type, size, created_by, created_at
     FROM attachments WHERE bin_id = $1 ORDER BY created_at ASC`,
    [binId],
  );

  res.json({ results: result.rows, count: result.rows.length });
}));

router.post('/bins/:id/attachments', requirePro(), asyncHandler(async (req, res, next) => {
  const cl = req.headers['content-length'];
  if (cl && Number(cl) > MAX_ATTACHMENT_BYTES + 1024) {
    throw new QuotaExceededError('PAYLOAD_TOO_LARGE', `Upload exceeds ${MAX_ATTACHMENT_SIZE_MB} MB limit`);
  }

  const binId = req.params.id;
  const access = await verifyBinAccess(binId, req.user!.id);
  if (!access) {
    throw new NotFoundError('Bin not found');
  }
  await requireMemberOrAbove(access.locationId, req.user!.id, 'upload attachments');

  res.locals.binAccess = access;
  next();
}), attachmentUpload.single('file'), asyncHandler(async (req, res) => {
  const binId = req.params.id;
  const file = req.file;
  if (!file) {
    throw new ValidationError('No file uploaded');
  }

  const access = res.locals.binAccess as import('../lib/binAccess.js').BinAccessResult;

  const originalName = path.basename(file.originalname).slice(0, 255);
  const ext = path.extname(originalName).toLowerCase();

  // Reserve an id by inserting a placeholder row first; retry on the rare
  // short-code collision. Once we have an id we upload exactly once, then
  // patch the row with the final storage path.
  const maxRetries = 10;
  let attachmentId = '';
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attachmentId = generateShortCode('ATT');
    try {
      await query(
        `INSERT INTO attachments (id, bin_id, filename, mime_type, size, storage_path, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, ${d.now()})`,
        [attachmentId, binId, originalName, file.mimetype, file.size, '', req.user!.id],
      );
      break;
    } catch (err) {
      if (isUniqueViolation(err) && attempt < maxRetries) continue;
      throw err;
    }
  }

  const storedFilename = ext ? `${attachmentId}${ext}` : attachmentId;
  const storagePath = attachmentStoragePath(binId, storedFilename);

  try {
    await storage.upload(storagePath, file.buffer, file.mimetype);
    await query('UPDATE attachments SET storage_path = $1 WHERE id = $2', [storagePath, attachmentId]);
  } catch (err) {
    await query('DELETE FROM attachments WHERE id = $1', [attachmentId]).catch(() => {});
    throw err;
  }

  await query(`UPDATE bins SET updated_at = ${d.now()} WHERE id = $1`, [binId]);

  logRouteActivity(req, {
    entityType: 'bin',
    locationId: access.locationId,
    action: 'add_attachment',
    entityId: binId,
    entityName: access.name,
  });

  res.status(201).json({ id: attachmentId });
}));

router.get('/attachments/:id/file', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const access = await verifyAttachmentAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Attachment not found');
  }

  const safeName = access.filename.replace(/[\r\n"\\]/g, '_') || 'attachment';
  res.setHeader('Content-Type', access.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('Cache-Control', 'private, no-store');

  const stream = storage.readStream(access.storagePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Attachment file not found' });
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
}));

router.delete('/attachments/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const access = await verifyAttachmentAccess(id, req.user!.id);
  if (!access) {
    throw new NotFoundError('Attachment not found');
  }

  const isAuthor = access.createdBy === req.user!.id;
  const isAdmin = access.role === 'admin';
  if (!isAuthor && !isAdmin) {
    throw new ForbiddenError('Only the uploader or a location admin can delete this attachment');
  }

  await query('DELETE FROM attachments WHERE id = $1', [id]);
  await Promise.all([
    storage.delete(access.storagePath).catch(() => {}),
    query(`UPDATE bins SET updated_at = ${d.now()} WHERE id = $1`, [access.binId]),
  ]);

  logRouteActivity(req, {
    locationId: access.locationId,
    action: 'delete_attachment',
    entityType: 'bin',
    entityId: access.binId,
    entityName: access.binName,
  });

  res.json({ message: 'Attachment deleted' });
}));

export default router;
