import fs from 'node:fs';
import path from 'node:path';
import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { ValidationError } from './httpErrors.js';

export const MAX_ATTACHMENT_SIZE_MB = 5;
export const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;

// Document/archive MIME types accepted by the attachments feature. Images
// are intentionally excluded — they belong in the photos feature.
const ATTACHMENT_MIME_TYPES = new Set<string>([
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/rtf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/zip',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
]);

// Extension fallback — browsers often report empty or octet-stream MIME
// for less-common types like .md, so we accept by extension too.
const ATTACHMENT_EXTENSIONS = new Set<string>([
  '.pdf', '.txt', '.csv', '.md', '.json', '.rtf',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp',
  '.zip', '.7z', '.tar', '.gz',
]);

const PHOTO_STORAGE_PATH = config.photoStoragePath;

const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const AVATAR_STORAGE_PATH = path.join(PHOTO_STORAGE_PATH, 'avatars');

/** Multer storage for bin photos — disk for local, memory for S3. */
const binPhotoStorageEngine =
  config.storageBackend === 's3'
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (req, _file, cb) => {
          const binId = req.params.id;
          const dir = path.join(PHOTO_STORAGE_PATH, binId);
          try {
            fs.mkdirSync(dir, { recursive: true });
          } catch (err) {
            cb(err as Error, '');
            return;
          }
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = MIME_TO_EXT[file.mimetype] || '.jpg';
          cb(null, `${uuidv4()}${ext}`);
        },
      });

/** Multer config for bin photo uploads (max 5 MB, JPEG/PNG/WebP/GIF). */
export const binPhotoUpload = multer({
  storage: binPhotoStorageEngine,
  limits: { fileSize: config.maxPhotoSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (PHOTO_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
  },
});

/** Multer storage for user avatars. */
export const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      fs.mkdirSync(AVATAR_STORAGE_PATH, { recursive: true });
    } catch (err) {
      cb(err as Error, '');
      return;
    }
    cb(null, AVATAR_STORAGE_PATH);
  },
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

/** Multer config for avatar uploads (max 2 MB, JPEG/PNG/WebP). */
export const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: config.maxAvatarSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (AVATAR_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

const ALLOWED_MIME_TYPES = new Set([...PHOTO_MIME_TYPES, ...AVATAR_MIME_TYPES]);

/** Verify file content matches an allowed image type using magic bytes. Deletes and throws if invalid. */
export async function validateFileType(filePath: string): Promise<void> {
  const detected = await fileTypeFromFile(filePath);
  if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
    fs.unlinkSync(filePath);
    throw new ValidationError('File content does not match an allowed image type');
  }
}

/** Verify in-memory file buffer matches an allowed image type using magic bytes. */
export async function validateFileBuffer(buffer: Buffer): Promise<void> {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
    throw new ValidationError('File content does not match an allowed image type');
  }
}

/** Multer config for in-memory photo uploads (AI analysis endpoints). */
export const memoryPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxPhotoSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (PHOTO_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
  },
});

const AUDIO_MIME_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav'];

/** Multer config for in-memory audio uploads (dictation endpoint, max 10 MB). */
export const memoryAudioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (AUDIO_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only WebM, MP4, OGG, MPEG, and WAV audio files are allowed'));
    }
  },
});

/** Multer config for demo account in-memory photo uploads (3 MB per file). */
export const demoMemoryPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (PHOTO_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
  },
});

/** Multer config for non-image bin attachments (docs/archives, 5 MB cap). */
export const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ATTACHMENT_MIME_TYPES.has(file.mimetype) || ATTACHMENT_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new ValidationError('File type not allowed'));
    }
  },
});

export { PHOTO_STORAGE_PATH, AVATAR_STORAGE_PATH, MIME_TO_EXT };
