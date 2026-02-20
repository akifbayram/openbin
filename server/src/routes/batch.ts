import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';
import { executeActions } from '../lib/commandExecutor.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ValidationError } from '../lib/httpErrors.js';
import { config } from '../lib/config.js';
import type { CommandAction } from '../lib/commandParser.js';

const router = Router();

const VALID_TYPES = new Set([
  'add_items', 'remove_items', 'modify_item', 'create_bin', 'delete_bin',
  'add_tags', 'remove_tags', 'modify_tag', 'set_area', 'set_notes',
  'set_icon', 'set_color', 'update_bin', 'restore_bin',
]);

const MAX_OPS = 50;

const noop = (_req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => next();

const batchLimiter = config.disableRateLimit ? noop : rateLimit({
  windowMs: 60 * 60 * 1000,
  max: (req: import('express').Request) => (req as any).authMethod === 'api_key' ? 600 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many batch requests, please try again later' },
});

router.post('/batch', authenticate, batchLimiter, requireLocationMember(), asyncHandler(async (req, res) => {
  const { locationId, operations } = req.body;

  if (!locationId || typeof locationId !== 'string') {
    throw new ValidationError('locationId is required');
  }

  if (!Array.isArray(operations) || operations.length === 0) {
    throw new ValidationError('operations must be a non-empty array');
  }

  if (operations.length > MAX_OPS) {
    throw new ValidationError(`operations array exceeds maximum of ${MAX_OPS}`);
  }

  // Validate each operation has a known type and required fields
  const actions: CommandAction[] = [];
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    if (!op || typeof op !== 'object') {
      throw new ValidationError(`operations[${i}]: must be an object`);
    }
    if (!op.type || !VALID_TYPES.has(op.type)) {
      throw new ValidationError(`operations[${i}]: unknown type "${op.type}"`);
    }

    // Type-specific required field validation
    switch (op.type) {
      case 'create_bin':
        if (!op.name || typeof op.name !== 'string') {
          throw new ValidationError(`operations[${i}]: create_bin requires "name"`);
        }
        actions.push({
          type: 'create_bin',
          name: op.name.trim(),
          area_name: typeof op.area_name === 'string' ? op.area_name.trim() : undefined,
          tags: Array.isArray(op.tags) ? op.tags.filter((t: unknown): t is string => typeof t === 'string') : undefined,
          items: Array.isArray(op.items) ? op.items.filter((i: unknown): i is string => typeof i === 'string') : undefined,
          color: typeof op.color === 'string' ? op.color : undefined,
          icon: typeof op.icon === 'string' ? op.icon : undefined,
          notes: typeof op.notes === 'string' ? op.notes : undefined,
        });
        break;

      case 'update_bin':
        if (!op.bin_id || typeof op.bin_id !== 'string') {
          throw new ValidationError(`operations[${i}]: update_bin requires "bin_id"`);
        }
        actions.push({
          type: 'update_bin',
          bin_id: op.bin_id,
          bin_name: (op.bin_name as string) || '',
          name: typeof op.name === 'string' ? op.name.trim() : undefined,
          notes: typeof op.notes === 'string' ? op.notes : undefined,
          tags: Array.isArray(op.tags) ? op.tags.filter((t: unknown): t is string => typeof t === 'string') : undefined,
          area_name: typeof op.area_name === 'string' ? op.area_name.trim() : undefined,
          icon: typeof op.icon === 'string' ? op.icon : undefined,
          color: typeof op.color === 'string' ? op.color : undefined,
          visibility: op.visibility === 'location' || op.visibility === 'private' ? op.visibility : undefined,
        });
        break;

      case 'delete_bin':
      case 'restore_bin':
        if (!op.bin_id || typeof op.bin_id !== 'string') {
          throw new ValidationError(`operations[${i}]: ${op.type} requires "bin_id"`);
        }
        actions.push({ type: op.type, bin_id: op.bin_id, bin_name: (op.bin_name as string) || '' });
        break;

      case 'add_items':
      case 'remove_items':
        if (!op.bin_id || typeof op.bin_id !== 'string') {
          throw new ValidationError(`operations[${i}]: ${op.type} requires "bin_id"`);
        }
        if (!Array.isArray(op.items) || op.items.length === 0) {
          throw new ValidationError(`operations[${i}]: ${op.type} requires non-empty "items" array`);
        }
        actions.push({
          type: op.type,
          bin_id: op.bin_id,
          bin_name: (op.bin_name as string) || '',
          items: op.items.filter((i: unknown): i is string => typeof i === 'string').map((i: string) => i.trim()).filter(Boolean),
        });
        break;

      case 'modify_item':
        if (!op.bin_id || typeof op.bin_id !== 'string') {
          throw new ValidationError(`operations[${i}]: modify_item requires "bin_id"`);
        }
        if (typeof op.old_item !== 'string' || typeof op.new_item !== 'string') {
          throw new ValidationError(`operations[${i}]: modify_item requires "old_item" and "new_item"`);
        }
        actions.push({
          type: 'modify_item',
          bin_id: op.bin_id,
          bin_name: (op.bin_name as string) || '',
          old_item: op.old_item.trim(),
          new_item: op.new_item.trim(),
        });
        break;

      case 'add_tags':
      case 'remove_tags':
        if (!op.bin_id || typeof op.bin_id !== 'string') {
          throw new ValidationError(`operations[${i}]: ${op.type} requires "bin_id"`);
        }
        if (!Array.isArray(op.tags) || op.tags.length === 0) {
          throw new ValidationError(`operations[${i}]: ${op.type} requires non-empty "tags" array`);
        }
        actions.push({
          type: op.type,
          bin_id: op.bin_id,
          bin_name: (op.bin_name as string) || '',
          tags: op.tags.filter((t: unknown): t is string => typeof t === 'string').map((t: string) => t.trim()).filter(Boolean),
        });
        break;

      case 'modify_tag':
        if (!op.bin_id || typeof op.bin_id !== 'string') {
          throw new ValidationError(`operations[${i}]: modify_tag requires "bin_id"`);
        }
        if (typeof op.old_tag !== 'string' || typeof op.new_tag !== 'string') {
          throw new ValidationError(`operations[${i}]: modify_tag requires "old_tag" and "new_tag"`);
        }
        actions.push({
          type: 'modify_tag',
          bin_id: op.bin_id,
          bin_name: (op.bin_name as string) || '',
          old_tag: op.old_tag.trim(),
          new_tag: op.new_tag.trim(),
        });
        break;

      case 'set_area':
        if (!op.bin_id || typeof op.bin_id !== 'string') {
          throw new ValidationError(`operations[${i}]: set_area requires "bin_id"`);
        }
        if (typeof op.area_name !== 'string') {
          throw new ValidationError(`operations[${i}]: set_area requires "area_name"`);
        }
        actions.push({
          type: 'set_area',
          bin_id: op.bin_id,
          bin_name: (op.bin_name as string) || '',
          area_id: typeof op.area_id === 'string' ? op.area_id : null,
          area_name: op.area_name.trim(),
        });
        break;

      case 'set_notes': {
        if (!op.bin_id || typeof op.bin_id !== 'string') {
          throw new ValidationError(`operations[${i}]: set_notes requires "bin_id"`);
        }
        const mode = op.mode as string;
        if (!['set', 'append', 'clear'].includes(mode)) {
          throw new ValidationError(`operations[${i}]: set_notes requires "mode" (set|append|clear)`);
        }
        actions.push({
          type: 'set_notes',
          bin_id: op.bin_id,
          bin_name: (op.bin_name as string) || '',
          notes: typeof op.notes === 'string' ? op.notes : '',
          mode: mode as 'set' | 'append' | 'clear',
        });
        break;
      }

      case 'set_icon':
        if (!op.bin_id || typeof op.bin_id !== 'string') {
          throw new ValidationError(`operations[${i}]: set_icon requires "bin_id"`);
        }
        if (typeof op.icon !== 'string') {
          throw new ValidationError(`operations[${i}]: set_icon requires "icon"`);
        }
        actions.push({ type: 'set_icon', bin_id: op.bin_id, bin_name: (op.bin_name as string) || '', icon: op.icon });
        break;

      case 'set_color':
        if (!op.bin_id || typeof op.bin_id !== 'string') {
          throw new ValidationError(`operations[${i}]: set_color requires "bin_id"`);
        }
        if (typeof op.color !== 'string') {
          throw new ValidationError(`operations[${i}]: set_color requires "color"`);
        }
        actions.push({ type: 'set_color', bin_id: op.bin_id, bin_name: (op.bin_name as string) || '', color: op.color });
        break;
    }
  }

  const result = await executeActions(actions, locationId, req.user!.id, req.user!.username, req.authMethod, req.apiKeyId);

  res.json({
    results: result.executed,
    errors: result.errors,
  });
}));

export { router as batchRoutes };
