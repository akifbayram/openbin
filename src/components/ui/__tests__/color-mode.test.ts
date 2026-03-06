import { describe, expect, it } from 'vitest';
import { cycleColorMode } from '@/components/ui/color-mode';

describe('cycleColorMode', () => {
  it('cycles light -> dark', () => {
    expect(cycleColorMode('light')).toBe('dark');
  });

  it('cycles dark -> system', () => {
    expect(cycleColorMode('dark')).toBe('system');
  });

  it('cycles system -> light', () => {
    expect(cycleColorMode('system')).toBe('light');
  });

  it('completes the full cycle', () => {
    let pref = cycleColorMode('light');
    expect(pref).toBe('dark');
    pref = cycleColorMode(pref);
    expect(pref).toBe('system');
    pref = cycleColorMode(pref);
    expect(pref).toBe('light');
  });
});
