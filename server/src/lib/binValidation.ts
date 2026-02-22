import { ValidationError } from './httpErrors.js';

export function validateBinFields(fields: {
  items?: unknown;
  tags?: unknown;
  notes?: unknown;
  icon?: unknown;
  color?: unknown;
  cardStyle?: unknown;
  visibility?: unknown;
}): void {
  const { items, tags, notes, icon, color, cardStyle, visibility } = fields;

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
      if (typeof item === 'string' && item.length > 500) {
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
}
