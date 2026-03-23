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

function makeContext(overrides: Partial<TourContext> = {}): TourContext {
  return {
    canWrite: true,
    aiEnabled: true,
    firstBinId: 'abc123',
    terminology: DEFAULT_TERMINOLOGY,
    isMobile: false,
    openCommandInput: () => {},
    closeCommandInput: () => {},
    ...overrides,
  };
}

describe('filterSteps', () => {
  it('returns all 8 steps for writer + AI configured', () => {
    const ctx = makeContext();
    const filtered = filterSteps(TOUR_STEPS, ctx);
    expect(filtered).toHaveLength(8);
  });

  it('returns 6 steps for writer without AI (skips snap-to-create and reorganize)', () => {
    const ctx = makeContext({ aiEnabled: false });
    const filtered = filterSteps(TOUR_STEPS, ctx);
    expect(filtered).toHaveLength(6);
    const ids = filtered.map((s) => s.id);
    expect(ids).not.toContain('snap-to-create');
    expect(ids).not.toContain('reorganize');
  });

  it('returns 5 steps for viewer (skips quick-add, snap-to-create, reorganize)', () => {
    const ctx = makeContext({ canWrite: false });
    const filtered = filterSteps(TOUR_STEPS, ctx);
    expect(filtered).toHaveLength(5);
    const ids = filtered.map((s) => s.id);
    expect(ids).not.toContain('quick-add');
    expect(ids).not.toContain('snap-to-create');
    expect(ids).not.toContain('reorganize');
  });

  it('skips bin-detail steps when no bins exist', () => {
    const ctx = makeContext({ firstBinId: null });
    const filtered = filterSteps(TOUR_STEPS, ctx);
    const ids = filtered.map((s) => s.id);
    expect(ids).not.toContain('qr-section');
    expect(ids).not.toContain('quick-add');
  });

  it('viewer with no bins sees 4 steps', () => {
    const ctx = makeContext({ canWrite: false, firstBinId: null });
    const filtered = filterSteps(TOUR_STEPS, ctx);
    expect(filtered).toHaveLength(4);
    const ids = filtered.map((s) => s.id);
    expect(ids).toContain('ask-ai');
    expect(ids).toContain('scan-qr');
    expect(ids).toContain('print-labels');
    expect(ids).toContain('cta');
  });

  it('first step is always ask-ai', () => {
    const ctx = makeContext();
    const filtered = filterSteps(TOUR_STEPS, ctx);
    expect(filtered[0].id).toBe('ask-ai');
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
    // Verify we don't return to a route we already left
    const visited = new Set<string>();
    let prev = '';
    let backtracks = 0;
    for (const route of routes) {
      if (route !== prev && visited.has(route)) {
        // Returning to /bins at the end for scan-qr and cta is expected
        if (route === '/bins') continue;
        backtracks++;
      }
      visited.add(route);
      prev = route;
    }
    expect(backtracks).toBe(0);
  });
});

describe('resolveSelector', () => {
  it('returns Ask AI selector when AI is enabled', () => {
    const ctx = makeContext({ aiEnabled: true });
    const step = TOUR_STEPS.find((s) => s.id === 'ask-ai')!;
    expect(resolveSelector(step, ctx)).toBe('button[aria-label="Ask AI"]');
  });

  it('falls back to Scan button when AI is not enabled', () => {
    const ctx = makeContext({ aiEnabled: false });
    const step = TOUR_STEPS.find((s) => s.id === 'ask-ai')!;
    expect(resolveSelector(step, ctx)).toBe('button[aria-label="Scan QR code"]');
  });

  it('uses data-tour selector for snap-to-create', () => {
    const ctx = makeContext();
    const step = TOUR_STEPS.find((s) => s.id === 'snap-to-create')!;
    expect(resolveSelector(step, ctx)).toBe('[data-tour="photo-buttons"]');
  });
});

describe('resolveRoute', () => {
  it('returns bin detail route with firstBinId', () => {
    const ctx = makeContext({ firstBinId: 'xyz789' });
    const step = TOUR_STEPS.find((s) => s.id === 'qr-section')!;
    expect(resolveRoute(step, ctx)).toBe('/bin/xyz789');
  });

  it('returns /bins for static routes', () => {
    const ctx = makeContext();
    const step = TOUR_STEPS.find((s) => s.id === 'ask-ai')!;
    expect(resolveRoute(step, ctx)).toBe('/bins');
  });

  it('returns /reorganize for reorganize step', () => {
    const ctx = makeContext();
    const step = TOUR_STEPS.find((s) => s.id === 'reorganize')!;
    expect(resolveRoute(step, ctx)).toBe('/reorganize');
  });
});

describe('resolveTitle', () => {
  it('returns dynamic title with terminology', () => {
    const ctx = makeContext();
    const step = TOUR_STEPS.find((s) => s.id === 'qr-section')!;
    expect(resolveTitle(step, ctx)).toBe('Bin QR code');
  });

  it('returns static title as-is', () => {
    const ctx = makeContext();
    const step = TOUR_STEPS.find((s) => s.id === 'ask-ai')!;
    expect(resolveTitle(step, ctx)).toBe('Ask AI anything');
  });
});

describe('resolveBody', () => {
  it('adapts body for AI-enabled user', () => {
    const ctx = makeContext({ aiEnabled: true, canWrite: true });
    const step = TOUR_STEPS.find((s) => s.id === 'ask-ai')!;
    const body = resolveBody(step, ctx);
    expect(body).toContain('add batteries');
  });

  it('adapts body for non-AI user', () => {
    const ctx = makeContext({ aiEnabled: false });
    const step = TOUR_STEPS.find((s) => s.id === 'ask-ai')!;
    const body = resolveBody(step, ctx);
    expect(body).toContain('AI provider connected');
  });

  it('CTA body adapts for writer + AI', () => {
    const ctx = makeContext({ canWrite: true, aiEnabled: true });
    const step = TOUR_STEPS.find((s) => s.id === 'cta')!;
    const body = resolveBody(step, ctx);
    expect(body).toContain('create a bin for kitchen utensils');
  });

  it('CTA body adapts for viewer', () => {
    const ctx = makeContext({ canWrite: false, aiEnabled: true });
    const step = TOUR_STEPS.find((s) => s.id === 'cta')!;
    const body = resolveBody(step, ctx);
    expect(body).toContain('replay this tour');
  });

  it('uses custom terminology in body text', () => {
    const ctx = makeContext({
      terminology: { ...DEFAULT_TERMINOLOGY, bin: 'container', bins: 'containers' },
    });
    const step = TOUR_STEPS.find((s) => s.id === 'ask-ai')!;
    const body = resolveBody(step, ctx);
    expect(body).toContain('containers');
  });
});
