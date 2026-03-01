import { describe, expect, it } from 'vitest';
import { cycleThemePreference } from '@/lib/theme';

describe('cycleThemePreference', () => {
  it('cycles light -> dark', () => {
    expect(cycleThemePreference('light')).toBe('dark');
  });

  it('cycles dark -> auto', () => {
    expect(cycleThemePreference('dark')).toBe('auto');
  });

  it('cycles auto -> light', () => {
    expect(cycleThemePreference('auto')).toBe('light');
  });

  it('completes the full cycle', () => {
    let pref = cycleThemePreference('light');
    expect(pref).toBe('dark');
    pref = cycleThemePreference(pref);
    expect(pref).toBe('auto');
    pref = cycleThemePreference(pref);
    expect(pref).toBe('light');
  });
});
