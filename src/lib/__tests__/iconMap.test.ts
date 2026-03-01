import { Package, Wrench } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ICON, ICON_MAP, ICON_NAMES, resolveIcon } from '@/lib/iconMap';

describe('iconMap', () => {
  it('resolveIcon returns the correct icon for a known name', () => {
    expect(resolveIcon('Wrench')).toBe(Wrench);
  });

  it('resolveIcon returns Package for empty string', () => {
    expect(resolveIcon('')).toBe(Package);
  });

  it('resolveIcon returns Package for non-existent name', () => {
    expect(resolveIcon('NonExistent')).toBe(Package);
  });

  it('ICON_NAMES has 30 entries', () => {
    expect(ICON_NAMES).toHaveLength(30);
  });

  it('DEFAULT_ICON is Package', () => {
    expect(DEFAULT_ICON).toBe('Package');
  });

  it('ICON_MAP contains all expected icons', () => {
    const expectedNames = [
      'Package', 'Box', 'Archive', 'Wrench', 'Shirt', 'Book', 'Utensils',
      'Laptop', 'Camera', 'Music', 'Heart', 'Star', 'Home', 'Car', 'Bike',
      'Plane', 'Briefcase', 'ShoppingBag', 'Gift', 'Lightbulb', 'Scissors',
      'Hammer', 'Paintbrush', 'Leaf', 'Apple', 'Coffee', 'Wine', 'Baby', 'Dog', 'Cat',
    ];
    for (const name of expectedNames) {
      expect(ICON_MAP[name]).toBeDefined();
    }
  });
});
