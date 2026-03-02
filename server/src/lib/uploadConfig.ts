import fs from 'node:fs';
import path from 'node:path';
import { fileTypeFromFile } from 'file-type';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { ValidationError } from './httpErrors.js';

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

/** Multer storage for bin photos (stored in per-bin subdirectories). */
export const binPhotoStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const binId = req.params.id;
    const dir = path.join(PHOTO_STORAGE_PATH, binId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

/** Multer config for bin photo uploads (max 5 MB, JPEG/PNG/WebP/GIF). */
export const binPhotoUpload = multer({
  storage: binPhotoStorage,
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
    fs.mkdirSync(AVATAR_STORAGE_PATH, { recursive: true });
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

export { PHOTO_STORAGE_PATH, AVATAR_STORAGE_PATH };
