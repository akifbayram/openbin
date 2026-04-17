import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireMemberOrAbove } from '../lib/binAccess.js';
import { executeActions } from '../lib/commandExecutor.js';
import type { CommandAction } from '../lib/commandParser.js';
import { config } from '../lib/config.js';
import { ValidationError } from '../lib/httpErrors.js';
import { validateBinName } from '../lib/validation.js';
import { authenticate } from '../middleware/auth.js';
import { requireLocationMember } from '../middleware/locationAccess.js';

const router = Router();

type OperationType = CommandAction['type'];

const VALID_TYPES = new Set<OperationType>([
  'add_items', 'remove_items', 'modify_item', 'create_bin', 'delete_bin',
  'add_tags', 'remove_tags', 'modify_tag', 'set_area', 'set_notes',
  'set_icon', 'set_color', 'update_bin', 'restore_bin',
  'duplicate_bin', 'pin_bin', 'unpin_bin', 'rename_area', 'delete_area',
  'set_tag_color', 'reorder_items', 'checkout_item', 'return_item',
]);

const MAX_OPS = 50;
const MAX_AREA_NAME = 255;

type OpInput = Record<string, unknown>;

// ---------- Small input helpers (consistent error messages per-index) ----------

function fail(index: number, message: string): never {
  throw new ValidationError(`operations[${index}]: ${message}`);
}

function requireString(op: OpInput, field: string, index: number, opType: OperationType): string {
  const value = op[field];
  if (!value || typeof value !== 'string') {
    fail(index, `${opType} requires "${field}"`);
  }
  return value;
}

function optionalString(op: OpInput, field: string): string | undefined {
  const value = op[field];
  return typeof value === 'string' ? value : undefined;
}

function optionalTrimmedString(op: OpInput, field: string): string | undefined {
  const value = op[field];
  return typeof value === 'string' ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter(Boolean);
}

function requireNonEmptyArray(op: OpInput, field: string, index: number, opType: OperationType): unknown[] {
  const value = op[field];
  if (!Array.isArray(value) || value.length === 0) {
    fail(index, `${opType} requires non-empty "${field}" array`);
  }
  return value;
}

function optionalRecord(value: unknown): Record<string, string> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, string>)
    : undefined;
}

function binName(op: OpInput): string {
  return (op.bin_name as string) || '';
}

function validateAreaName(value: unknown, index: number): void {
  if (typeof value === 'string' && value.length > MAX_AREA_NAME) {
    fail(index, `area_name exceeds ${MAX_AREA_NAME} characters`);
  }
}

/** Normalize add_items payload: accepts strings or { name, quantity } objects. */
function normalizeAddItems(raw: unknown[]): (string | { name: string; quantity?: number })[] {
  const result: (string | { name: string; quantity?: number })[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      result.push(item.trim());
    } else if (item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string') {
      const obj = item as { name: string; quantity?: unknown };
      const name = obj.name.trim();
      if (!name) continue;
      const entry: { name: string; quantity?: number } = { name };
      if (typeof obj.quantity === 'number' && obj.quantity > 0) entry.quantity = obj.quantity;
      result.push(entry);
    }
  }
  return result;
}

/** Filter create_bin items to preserve either strings or {name} objects (schema-compatible with CommandAction). */
function filterCreateBinItems(value: unknown): (string | { name: string; quantity?: number })[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((i): i is string | { name: string; quantity?: number } =>
    typeof i === 'string' ||
    (!!i && typeof i === 'object' && typeof (i as { name?: unknown }).name === 'string'),
  );
}

// ---------- Per-operation validators returning a CommandAction ----------

type Validator = (op: OpInput, index: number) => CommandAction;

const OPERATION_VALIDATORS: Record<OperationType, Validator> = {
  create_bin(op, i) {
    const name = validateBinName(op.name);
    validateAreaName(op.area_name, i);
    return {
      type: 'create_bin',
      name,
      area_name: optionalTrimmedString(op, 'area_name'),
      tags: Array.isArray(op.tags) ? stringArray(op.tags) : undefined,
      items: filterCreateBinItems(op.items),
      color: optionalString(op, 'color'),
      icon: optionalString(op, 'icon'),
      notes: optionalString(op, 'notes'),
      card_style: optionalString(op, 'card_style'),
      custom_fields: optionalRecord(op.custom_fields),
    };
  },

  update_bin(op, i) {
    const bin_id = requireString(op, 'bin_id', i, 'update_bin');
    validateAreaName(op.area_name, i);
    const visibility = op.visibility === 'location' || op.visibility === 'private' ? op.visibility : undefined;
    return {
      type: 'update_bin',
      bin_id,
      bin_name: binName(op),
      name: optionalTrimmedString(op, 'name'),
      notes: optionalString(op, 'notes'),
      tags: Array.isArray(op.tags) ? stringArray(op.tags) : undefined,
      area_name: optionalTrimmedString(op, 'area_name'),
      icon: optionalString(op, 'icon'),
      color: optionalString(op, 'color'),
      card_style: optionalString(op, 'card_style'),
      visibility,
      custom_fields: optionalRecord(op.custom_fields),
    };
  },

  delete_bin: (op, i) => ({
    type: 'delete_bin',
    bin_id: requireString(op, 'bin_id', i, 'delete_bin'),
    bin_name: binName(op),
  }),

  restore_bin: (op, i) => ({
    type: 'restore_bin',
    bin_id: requireString(op, 'bin_id', i, 'restore_bin'),
    bin_name: binName(op),
  }),

  add_items(op, i) {
    const bin_id = requireString(op, 'bin_id', i, 'add_items');
    const raw = requireNonEmptyArray(op, 'items', i, 'add_items');
    return {
      type: 'add_items',
      bin_id,
      bin_name: binName(op),
      items: normalizeAddItems(raw),
    };
  },

  remove_items(op, i) {
    const bin_id = requireString(op, 'bin_id', i, 'remove_items');
    const raw = requireNonEmptyArray(op, 'items', i, 'remove_items');
    return {
      type: 'remove_items',
      bin_id,
      bin_name: binName(op),
      items: stringArray(raw),
    };
  },

  modify_item(op, i) {
    const bin_id = requireString(op, 'bin_id', i, 'modify_item');
    if (typeof op.old_item !== 'string' || typeof op.new_item !== 'string') {
      fail(i, 'modify_item requires "old_item" and "new_item"');
    }
    return {
      type: 'modify_item',
      bin_id,
      bin_name: binName(op),
      old_item: op.old_item.trim(),
      new_item: op.new_item.trim(),
    };
  },

  add_tags(op, i) {
    const bin_id = requireString(op, 'bin_id', i, 'add_tags');
    const raw = requireNonEmptyArray(op, 'tags', i, 'add_tags');
    return {
      type: 'add_tags',
      bin_id,
      bin_name: binName(op),
      tags: stringArray(raw),
    };
  },

  remove_tags(op, i) {
    const bin_id = requireString(op, 'bin_id', i, 'remove_tags');
    const raw = requireNonEmptyArray(op, 'tags', i, 'remove_tags');
    return {
      type: 'remove_tags',
      bin_id,
      bin_name: binName(op),
      tags: stringArray(raw),
    };
  },

  modify_tag(op, i) {
    const bin_id = requireString(op, 'bin_id', i, 'modify_tag');
    if (typeof op.old_tag !== 'string' || typeof op.new_tag !== 'string') {
      fail(i, 'modify_tag requires "old_tag" and "new_tag"');
    }
    return {
      type: 'modify_tag',
      bin_id,
      bin_name: binName(op),
      old_tag: op.old_tag.trim(),
      new_tag: op.new_tag.trim(),
    };
  },

  set_area(op, i) {
    const bin_id = requireString(op, 'bin_id', i, 'set_area');
    if (typeof op.area_name !== 'string') {
      fail(i, 'set_area requires "area_name"');
    }
    validateAreaName(op.area_name, i);
    return {
      type: 'set_area',
      bin_id,
      bin_name: binName(op),
      area_id: typeof op.area_id === 'string' ? op.area_id : null,
      area_name: op.area_name.trim(),
    };
  },

  set_notes(op, i) {
    const bin_id = requireString(op, 'bin_id', i, 'set_notes');
    const mode = op.mode;
    if (mode !== 'set' && mode !== 'append' && mode !== 'clear') {
      fail(i, 'set_notes requires "mode" (set|append|clear)');
    }
    return {
      type: 'set_notes',
      bin_id,
      bin_name: binName(op),
      notes: typeof op.notes === 'string' ? op.notes : '',
      mode,
    };
  },

  set_icon(op, i) {
    const bin_id = requireString(op, 'bin_id', i, 'set_icon');
    if (typeof op.icon !== 'string') {
      fail(i, 'set_icon requires "icon"');
    }
    return { type: 'set_icon', bin_id, bin_name: binName(op), icon: op.icon };
  },

  set_color(op, i) {
    const bin_id = requireString(op, 'bin_id', i, 'set_color');
    if (typeof op.color !== 'string') {
      fail(i, 'set_color requires "color"');
    }
    return { type: 'set_color', bin_id, bin_name: binName(op), color: op.color };
  },

  duplicate_bin(op, i) {
    const bin_id = requireString(op, 'bin_id', i, 'duplicate_bin');
    return {
      type: 'duplicate_bin',
      bin_id,
      bin_name: binName(op),
      new_name: optionalTrimmedString(op, 'new_name'),
    };
  },

  pin_bin: (op, i) => ({
    type: 'pin_bin',
    bin_id: requireString(op, 'bin_id', i, 'pin_bin'),
    bin_name: binName(op),
  }),

  unpin_bin: (op, i) => ({
    type: 'unpin_bin',
    bin_id: requireString(op, 'bin_id', i, 'unpin_bin'),
    bin_name: binName(op),
  }),

  rename_area(op, i) {
    const area_id = requireString(op, 'area_id', i, 'rename_area');
    const new_name = requireString(op, 'new_name', i, 'rename_area');
    if (new_name.length > MAX_AREA_NAME) {
      fail(i, `new_name exceeds ${MAX_AREA_NAME} characters`);
    }
    return {
      type: 'rename_area',
      area_id,
      area_name: (op.area_name as string) || '',
      new_name: new_name.trim(),
    };
  },

  delete_area(op, i) {
    const area_id = requireString(op, 'area_id', i, 'delete_area');
    return {
      type: 'delete_area',
      area_id,
      area_name: (op.area_name as string) || '',
    };
  },

  set_tag_color(op, i) {
    if (typeof op.tag !== 'string' || !op.tag.trim()) {
      fail(i, 'set_tag_color requires "tag"');
    }
    if (typeof op.color !== 'string') {
      fail(i, 'set_tag_color requires "color"');
    }
    return { type: 'set_tag_color', tag: op.tag.trim(), color: op.color };
  },

  reorder_items(op, i) {
    const bin_id = requireString(op, 'bin_id', i, 'reorder_items');
    const raw = requireNonEmptyArray(op, 'item_ids', i, 'reorder_items');
    return {
      type: 'reorder_items',
      bin_id,
      bin_name: binName(op),
      item_ids: raw.filter((id): id is string => typeof id === 'string'),
    };
  },

  checkout_item(op, i) {
    const bin_id = requireString(op, 'bin_id', i, 'checkout_item');
    if (typeof op.item_name !== 'string' || !op.item_name.trim()) {
      fail(i, 'checkout_item requires "item_name"');
    }
    return {
      type: 'checkout_item',
      bin_id,
      bin_name: binName(op),
      item_name: op.item_name.trim(),
    };
  },

  return_item(op, i) {
    const bin_id = requireString(op, 'bin_id', i, 'return_item');
    if (typeof op.item_name !== 'string' || !op.item_name.trim()) {
      fail(i, 'return_item requires "item_name"');
    }
    return {
      type: 'return_item',
      bin_id,
      bin_name: binName(op),
      item_name: op.item_name.trim(),
      target_bin_id: typeof op.target_bin_id === 'string' ? op.target_bin_id : undefined,
      target_bin_name: typeof op.target_bin_name === 'string' ? op.target_bin_name : undefined,
    };
  },
};

// ---------- Route ----------

const noop = (_req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => next();

const batchLimiter = config.disableRateLimit ? noop : rateLimit({
  windowMs: 60 * 60 * 1000,
  max: (req: import('express').Request) => req.authMethod === 'api_key' ? 600 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many batch requests, please try again later' },
});

router.post('/batch', authenticate, batchLimiter, requireLocationMember(), asyncHandler(async (req, res) => {
  const { locationId, operations } = req.body;

  if (!locationId || typeof locationId !== 'string') {
    throw new ValidationError('locationId is required');
  }

  await requireMemberOrAbove(locationId, req.user!.id, 'perform batch operations');

  if (!Array.isArray(operations) || operations.length === 0) {
    throw new ValidationError('operations must be a non-empty array');
  }

  if (operations.length > MAX_OPS) {
    throw new ValidationError(`operations array exceeds maximum of ${MAX_OPS}`);
  }

  const actions: CommandAction[] = operations.map((op: unknown, i: number) => {
    if (!op || typeof op !== 'object') {
      throw new ValidationError(`operations[${i}]: must be an object`);
    }
    const typedOp = op as OpInput;
    const opType = typedOp.type as OperationType;
    if (!opType || !VALID_TYPES.has(opType)) {
      throw new ValidationError(`operations[${i}]: unknown type "${String(typedOp.type)}"`);
    }
    return OPERATION_VALIDATORS[opType](typedOp, i);
  });

  const result = await executeActions(actions, locationId, req.user!.id, req.user!.email, req.authMethod, req.apiKeyId);

  res.json({
    results: result.executed,
    errors: result.errors,
  });
}));

export { router as batchRoutes };
