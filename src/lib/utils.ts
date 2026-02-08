import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function haptic(pattern: number | number[] = 10) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}
