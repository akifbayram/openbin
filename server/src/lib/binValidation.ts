import { ValidationError } from './httpErrors.js';

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
    for (const item of items) {
      const name = typeof item === 'string' ? item : (item as { name: string })?.name;
      if (typeof name === 'string' && name.length > 500) {
        throw new ValidationError('Item name too long (max 500 characters)');
      }
    }
  }
  if (tags !== undefined && Array.isArray(tags)) {
    for (const tag of tags) {
      if (typeof tag === 'string' && tag.length > 100) {
        throw new ValidationError('Tag too long (max 100 characters)');
      }
    }
  }
  if (icon !== undefined && typeof icon === 'string' && icon.length > 100) {
    throw new ValidationError('Icon value too long (max 100 characters)');
  }
  if (color !== undefined && typeof color === 'string' && color.length > 50) {
    throw new ValidationError('Color value too long (max 50 characters)');
  }
  if (cardStyle !== undefined && typeof cardStyle === 'string' && cardStyle.length > 500) {
    throw new ValidationError('Card style too long (max 500 characters)');
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
