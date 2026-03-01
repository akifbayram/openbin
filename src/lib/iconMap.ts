import {Apple, Archive, Baby, Bike, Book, Box, Briefcase, Camera, Car, Cat,Coffee, Dog, Gift, Hammer, 
  Heart, Home, Laptop, Leaf, Lightbulb,
  type LucideIcon,Music,
  Package, Paintbrush, Plane, 
  Scissors, Shirt, ShoppingBag, Star, Utensils, Wine, Wrench, 
} from 'lucide-react';

export const ICON_MAP: Record<string, LucideIcon> = {
  Package, Box, Archive, Wrench, Shirt, Book, Utensils, Laptop, Camera, Music,
  Heart, Star, Home, Car, Bike, Plane, Briefcase, ShoppingBag, Gift, Lightbulb,
  Scissors, Hammer, Paintbrush, Leaf, Apple, Coffee, Wine, Baby, Dog, Cat,
};

export const ICON_NAMES = Object.keys(ICON_MAP);

export const DEFAULT_ICON = 'Package';

export function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] || ICON_MAP[DEFAULT_ICON];
}
