import type { Request } from 'express';
import { ValidationError } from './httpErrors.js';

// ── Uploaded-file extraction ───────────────────────────────────────

/** Extract uploaded photo files from multipart `photo` / `photos` fields. Throws if none present. */
export function extractUploadedFiles(req: Request): Express.Multer.File[] {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const allFiles = [
    ...(files?.photo || []),
    ...(files?.photos || []),
  ].slice(0, 5);
  if (allFiles.length === 0) {
    throw new ValidationError('photo file is required (JPEG, PNG, WebP, or GIF, max 5MB)');
  }
  return allFiles;
}

// ── Photo-ID extraction ────────────────────────────────────────────

/** Extract and validate photo IDs from `photoId` (string) or `photoIds` (array). Throws if none. */
export function extractPhotoIds(body: Record<string, unknown>): string[] {
  const { photoId, photoIds } = body;
  let ids: string[] = [];
  if (Array.isArray(photoIds) && photoIds.length > 0) {
    ids = photoIds.filter((id: unknown): id is string => typeof id === 'string').slice(0, 5);
  } else if (typeof photoId === 'string') {
    ids = [photoId];
  }
  if (ids.length === 0) {
    throw new ValidationError('photoId or photoIds is required');
  }
  return ids;
}

// ── Previous-result validation & sanitization ──────────────────────

/** Validate that a value has `name` (string) and `items` (array). Throws ValidationError if not. */
export function validatePreviousResult(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as Record<string, unknown>).name !== 'string' ||
    !Array.isArray((value as Record<string, unknown>).items)
  ) {
    throw new ValidationError('previousResult must have name (string) and items (array)');
  }
  return value as Record<string, unknown>;
}

/** Clamp a previousResult to safe sizes to prevent oversized prompts. */
export function sanitizePreviousResult(previousResult: Record<string, unknown>) {
  return {
    name: String(previousResult.name ?? '').slice(0, 255),
    items: (previousResult.items as unknown[]).slice(0, 100).map((i) => {
      if (typeof i === 'string') return { name: i.slice(0, 500) };
      if (i && typeof i === 'object') {
        const obj = i as Record<string, unknown>;
        return {
          name: String(obj.name ?? '').slice(0, 500),
          ...(typeof obj.quantity === 'number' ? { quantity: obj.quantity } : {}),
        };
      }
      return { name: String(i).slice(0, 500) };
    }),
  };
}
