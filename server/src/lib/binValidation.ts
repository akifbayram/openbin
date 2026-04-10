import { ValidationError } from './httpErrors.js';
import { HEX_COLOR_REGEX, stripUnicodeControl } from './validation.js';

const CODE_REGEX = /^[A-Z0-9]{6}$/;
export const COLOR_KEY_REGEX = /^((neutral|\d{1,3}):[0-4]|black|white)$/;

export function validateCodeFormat(code: string): void {
  if (!CODE_REGEX.test(code)) {
    throw new ValidationError('Code must be exactly 6 alphanumeric characters');
  }
}

export function validateBinFields(fields: {
  items?: unknown;
  tags?: unknown;
  notes?: unknown;
  icon?: unknown;
  color?: unknown;
  cardStyle?: unknown;
  visibility?: unknown;
  customFields?: unknown;
}): void {
  const { items, tags, notes, icon, color, cardStyle, visibility, customFields } = fields;

  if (items !== undefined && Array.isArray(items) && items.length > 500) {
    throw new ValidationError('Too many items (max 500)');
  }
  if (tags !== undefined && Array.isArray(tags) && tags.length > 50) {
    throw new ValidationError('Too many tags (max 50)');
  }
  if (notes !== undefined && typeof notes === 'string' && notes.length > 10000) {
    throw new ValidationError('Notes too long (max 10000 characters)');
  }
  if (items !== undefined && Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (typeof item === 'string') {
        const sanitized = stripUnicodeControl(item.trim());
        if (sanitized.length > 500) {
          throw new ValidationError('Item name too long (max 500 characters)');
        }
        items[i] = sanitized;
      } else if (item && typeof (item as { name: string }).name === 'string') {
        const sanitized = stripUnicodeControl((item as { name: string }).name.trim());
        if (sanitized.length > 500) {
          throw new ValidationError('Item name too long (max 500 characters)');
        }
        (item as { name: string }).name = sanitized;
      }
    }
  }
  if (tags !== undefined && Array.isArray(tags)) {
    for (let i = 0; i < tags.length; i++) {
      if (typeof tags[i] === 'string') {
        const sanitized = stripUnicodeControl((tags[i] as string).trim());
        if (sanitized.length > 100) {
          throw new ValidationError('Tag too long (max 100 characters)');
        }
        tags[i] = sanitized;
      }
    }
  }
  if (icon !== undefined && typeof icon === 'string' && icon.length > 100) {
    throw new ValidationError('Icon value too long (max 100 characters)');
  }
  if (color !== undefined && typeof color === 'string' && color.length > 50) {
    throw new ValidationError('Color value too long (max 50 characters)');
  }
  if (color !== undefined && typeof color === 'string' && color !== '' && !HEX_COLOR_REGEX.test(color) && !COLOR_KEY_REGEX.test(color)) {
    throw new ValidationError('Color must be a valid hex color or color key');
  }
  if (cardStyle !== undefined && typeof cardStyle === 'string' && cardStyle.length > 500) {
    throw new ValidationError('Card style too long (max 500 characters)');
  }
  if (cardStyle !== undefined && typeof cardStyle === 'string' && cardStyle !== '') {
    try {
      const parsed = JSON.parse(cardStyle);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new ValidationError('Card style must be a JSON object');
      }
      const VALID_VARIANTS = ['default', 'border', 'gradient', 'stripe', 'photo'];
      if (parsed.variant && !VALID_VARIANTS.includes(parsed.variant)) {
        throw new ValidationError('Invalid card style variant');
      }
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new ValidationError('Card style must be valid JSON');
    }
  }
  if (visibility !== undefined && visibility !== 'location' && visibility !== 'private') {
    throw new ValidationError('visibility must be "location" or "private"');
  }
  if (customFields !== undefined) {
    if (typeof customFields !== 'object' || customFields === null || Array.isArray(customFields)) {
      throw new ValidationError('customFields must be an object');
    }
    const entries = Object.entries(customFields as Record<string, unknown>);
    if (entries.length > 50) {
      throw new ValidationError('Too many custom fields (max 50)');
    }
    for (const [key, value] of entries) {
      if (typeof key !== 'string' || key.length > 100) {
        throw new ValidationError('Custom field key too long (max 100 characters)');
      }
      if (typeof value !== 'string') {
        throw new ValidationError('Custom field values must be strings');
      }
      if (value.length > 2000) {
        throw new ValidationError('Custom field value too long (max 2000 characters)');
      }
    }
  }
}
