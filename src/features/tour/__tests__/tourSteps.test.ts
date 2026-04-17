import { describe, expect, it } from 'vitest';
import { DEFAULT_TERMINOLOGY } from '@/lib/terminology';
import {
  filterSteps,
  resolveBody,
  resolveRoute,
  resolveSelector,
  resolveTitle,
  TOUR_STEPS,
  type TourContext,
} from '../tourSteps';

function findStep(id: string) {
  const step = TOUR_STEPS.find((s) => s.id === id);
  if (!step) throw new Error(`Step "${id}" not found`);
  return step;
}

function makeContext(overrides: Partial<TourContext> = {}): TourContext {
  return {
    canWrite: true,
    aiEnabled: true,
    firstBinId: 'abc123',
    binIds: ['abc123', 'def456', 'ghi789'],
    terminology: DEFAULT_TERMINOLOGY,
    isMobile: false,
    openCommandInput: () => {},
    closeCommandInput: () => {},
    ...overrides,
  };
}

describe('filterSteps', () => {
  it('returns all 11 steps for writer + AI configured', () => {
    const ctx = makeContext();
    const filtered = filterSteps(TOUR_STEPS, ctx);
    expect(filtered).toHaveLength(11);
  });

  it('returns 8 steps for writer without AI (skips voice-input, photo-to-bin, reorganize)', () => {
    const ctx = makeContext({ aiEnabled: false });
    const filtered = filterSteps(TOUR_STEPS, ctx);
    expect(filtered).toHaveLength(8);
    const ids = filtered.map((s) => s.id);
    expect(ids).not.toContain('voice-input');
    expect(ids).not.toContain('photo-to-bin');
    expect(ids).not.toContain('reorganize');
  });

  it('returns 8 steps for viewer (keeps voice-input; skips photo-to-bin, quick-add, reorganize)', () => {
    const ctx = makeContext({ canWrite: false });
    const filtered = filterSteps(TOUR_STEPS, ctx);
    expect(filtered).toHaveLength(8);
    const ids = filtered.map((s) => s.id);
    expect(ids).toContain('voice-input');
    expect(ids).not.toContain('photo-to-bin');
    expect(ids).not.toContain('quick-add');
    expect(ids).not.toContain('reorganize');
  });

  it('skips bin-detail steps when no bins exist', () => {
    const ctx = makeContext({ firstBinId: null });
    const filtered = filterSteps(TOUR_STEPS, ctx);
    const ids = filtered.map((s) => s.id);
    expect(ids).not.toContain('bin-qr');
    expect(ids).not.toContain('quick-add');
    expect(ids).not.toContain('bin-tabs');
  });

  it('viewer with no bins sees 6 steps', () => {
    const ctx = makeContext({ canWrite: false, firstBinId: null });
    const filtered = filterSteps(TOUR_STEPS, ctx);
    expect(filtered).toHaveLength(6);
    const ids = filtered.map((s) => s.id);
    expect(ids).toEqual([
      'dashboard-overview',
      'ask-ai',
      'voice-input',
      'scan-qr',
      'print-mode',
      'cta',
    ]);
  });

  it('first step is always dashboard-overview', () => {
    const ctx = makeContext();
    const filtered = filterSteps(TOUR_STEPS, ctx);
    expect(filtered[0].id).toBe('dashboard-overview');
  });

  it('last step is always cta', () => {
    const ctx = makeContext();
    const filtered = filterSteps(TOUR_STEPS, ctx);
    expect(filtered[filtered.length - 1].id).toBe('cta');
  });

  it('route flow is linear — no back-and-forth', () => {
    const ctx = makeContext();
    const filtered = filterSteps(TOUR_STEPS, ctx);
    const routes = filtered.map((s) => resolveRoute(s, ctx));
    // Verify we don't return to a route we already left. The final cta step
    // returning to `/` is expected and exempt.
    const visited = new Set<string>();
    let prev = '';
    let backtracks = 0;
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      if (route !== prev && visited.has(route)) {
        if (route === '/' && i === routes.length - 1) continue;
        backtracks++;
      }
      visited.add(route);
      prev = route;
    }
    expect(backtracks).toBe(0);
  });
});

describe('resolveSelector', () => {
  it('returns Ask AI header selector when AI is enabled on desktop', () => {
    const ctx = makeContext({ aiEnabled: true, isMobile: false });
    expect(resolveSelector(findStep('ask-ai'), ctx)).toBe('button[aria-label="Ask AI"]');
  });

  it('scopes Ask AI to BottomNav on mobile', () => {
    const ctx = makeContext({ aiEnabled: true, isMobile: true });
    expect(resolveSelector(findStep('ask-ai'), ctx)).toBe(
      'nav[aria-label="Main navigation"] button[aria-label="Ask AI"]',
    );
  });

  it('falls back to Scan button when AI is not enabled', () => {
    const ctx = makeContext({ aiEnabled: false });
    expect(resolveSelector(findStep('ask-ai'), ctx)).toBe('button[aria-label="Scan QR code"]');
  });

  it('uses data-tour selector for photo-to-bin', () => {
    const ctx = makeContext();
    expect(resolveSelector(findStep('photo-to-bin'), ctx)).toBe('[data-tour="photo-to-bin"]');
  });

  it('uses data-tour selector for voice-input', () => {
    const ctx = makeContext();
    expect(resolveSelector(findStep('voice-input'), ctx)).toBe('[data-tour="voice-input"]');
  });

  it('uses data-tour selector for dashboard-overview', () => {
    const ctx = makeContext();
    expect(resolveSelector(findStep('dashboard-overview'), ctx)).toBe(
      '[data-tour="dashboard-overview"]',
    );
  });

  it('uses data-tour selector for bin-tabs', () => {
    const ctx = makeContext();
    expect(resolveSelector(findStep('bin-tabs'), ctx)).toBe('[data-tour="bin-tabs"]');
  });
});

describe('resolveRoute', () => {
  it('returns bin detail route with firstBinId for bin-qr', () => {
    const ctx = makeContext({ firstBinId: 'xyz789' });
    expect(resolveRoute(findStep('bin-qr'), ctx)).toBe('/bin/xyz789');
  });

  it('returns bin detail route with firstBinId for bin-tabs', () => {
    const ctx = makeContext({ firstBinId: 'xyz789' });
    expect(resolveRoute(findStep('bin-tabs'), ctx)).toBe('/bin/xyz789');
  });

  it('returns / for dashboard-overview', () => {
    const ctx = makeContext();
    expect(resolveRoute(findStep('dashboard-overview'), ctx)).toBe('/');
  });

  it('returns / for ask-ai', () => {
    const ctx = makeContext();
    expect(resolveRoute(findStep('ask-ai'), ctx)).toBe('/');
  });

  it('returns /reorganize for reorganize step', () => {
    const ctx = makeContext();
    expect(resolveRoute(findStep('reorganize'), ctx)).toBe('/reorganize');
  });

  it('returns /ask for photo-to-bin on mobile', () => {
    const ctx = makeContext({ isMobile: true });
    expect(resolveRoute(findStep('photo-to-bin'), ctx)).toBe('/ask');
  });

  it('returns / for photo-to-bin on desktop', () => {
    const ctx = makeContext({ isMobile: false });
    expect(resolveRoute(findStep('photo-to-bin'), ctx)).toBe('/');
  });

  it('returns /ask for voice-input on mobile', () => {
    const ctx = makeContext({ isMobile: true });
    expect(resolveRoute(findStep('voice-input'), ctx)).toBe('/ask');
  });

  it('returns / for voice-input on desktop', () => {
    const ctx = makeContext({ isMobile: false });
    expect(resolveRoute(findStep('voice-input'), ctx)).toBe('/');
  });
});

describe('resolveTitle', () => {
  it('returns dynamic title with terminology for bin-qr', () => {
    const ctx = makeContext();
    expect(resolveTitle(findStep('bin-qr'), ctx)).toBe('Every bin has a scannable code');
  });

  it('returns AI title when AI is enabled', () => {
    const ctx = makeContext({ aiEnabled: true });
    expect(resolveTitle(findStep('ask-ai'), ctx)).toBe('Ask AI anything');
  });

  it('returns fallback title when AI is not enabled', () => {
    const ctx = makeContext({ aiEnabled: false });
    expect(resolveTitle(findStep('ask-ai'), ctx)).toBe('Find your bins');
  });
});

describe('resolveBody', () => {
  it('adapts body for AI-enabled user', () => {
    const ctx = makeContext({ aiEnabled: true, canWrite: true });
    const body = resolveBody(findStep('ask-ai'), ctx);
    expect(body).toContain('Ask where something is');
  });

  it('adapts body for non-AI user', () => {
    const ctx = makeContext({ aiEnabled: false });
    const body = resolveBody(findStep('ask-ai'), ctx);
    expect(body).toContain('search bar');
  });

  it('CTA body adapts for writer + AI', () => {
    const ctx = makeContext({ canWrite: true, aiEnabled: true });
    const body = resolveBody(findStep('cta'), ctx);
    expect(body).toContain('create a bin for kitchen utensils');
  });

  it('CTA body adapts for viewer', () => {
    const ctx = makeContext({ canWrite: false, aiEnabled: true });
    const body = resolveBody(findStep('cta'), ctx);
    expect(body).toContain('replay this tour');
  });

  it('dashboard-overview body uses bins terminology', () => {
    const ctx = makeContext({
      terminology: { ...DEFAULT_TERMINOLOGY, bin: 'container', bins: 'containers' },
    });
    const body = resolveBody(findStep('dashboard-overview'), ctx);
    expect(body).toContain('containers');
  });

  it('bin-tabs body uses bin terminology', () => {
    const ctx = makeContext({
      terminology: { ...DEFAULT_TERMINOLOGY, bin: 'container', bins: 'containers' },
    });
    const body = resolveBody(findStep('bin-tabs'), ctx);
    expect(body).toContain('container');
  });

  it('uses custom terminology in ask-ai body', () => {
    const ctx = makeContext({
      terminology: { ...DEFAULT_TERMINOLOGY, bin: 'container', bins: 'containers' },
    });
    const body = resolveBody(findStep('ask-ai'), ctx);
    expect(body).toContain('containers');
  });
});
