import { describe, expect, it } from 'vitest';
import { computeAnalyzeLabel } from '../analyzeLabel';

describe('computeAnalyzeLabel', () => {
  describe('analyze mode', () => {
    it('starts with "Scanning"', () => {
      const r = computeAnalyzeLabel({ mode: 'analyze', partialText: '', complete: false });
      expect(r.text).toBe('Scanning');
      expect(r.showEllipsis).toBe(true);
      expect(r.itemCount).toBe(0);
    });

    it('keeps "Scanning" while only the name has streamed', () => {
      const r = computeAnalyzeLabel({
        mode: 'analyze',
        partialText: '{"name": "Toolbox"',
        complete: false,
      });
      expect(r.text).toBe('Scanning');
    });

    it('shows "Found 1 item" with one item', () => {
      const r = computeAnalyzeLabel({
        mode: 'analyze',
        partialText: '{"name": "T", "items": ["A"',
        complete: false,
      });
      expect(r.text).toBe('Found 1 item');
      expect(r.itemCount).toBe(1);
    });

    it('shows "Found N items" with multiple items', () => {
      const r = computeAnalyzeLabel({
        mode: 'analyze',
        partialText: '{"name": "T", "items": ["A", "B", "C", "D"',
        complete: false,
      });
      expect(r.text).toBe('Found 4 items');
      expect(r.itemCount).toBe(4);
    });

    it('shows "Done" without ellipsis when complete', () => {
      const r = computeAnalyzeLabel({
        mode: 'analyze',
        partialText: '{"name": "T", "items": ["A", "B"]}',
        complete: true,
      });
      expect(r.text).toBe('Done');
      expect(r.showEllipsis).toBe(false);
    });
  });

  describe('reanalyze mode', () => {
    it('starts with "Reanalyzing"', () => {
      const r = computeAnalyzeLabel({ mode: 'reanalyze', partialText: '', complete: false });
      expect(r.text).toBe('Reanalyzing');
    });

    it('switches to "Found N items" once items stream', () => {
      const r = computeAnalyzeLabel({
        mode: 'reanalyze',
        partialText: '{"name": "T", "items": ["A", "B", "C"',
        complete: false,
      });
      expect(r.text).toBe('Found 3 items');
    });

    it('shows "Done" on complete', () => {
      const r = computeAnalyzeLabel({ mode: 'reanalyze', partialText: '', complete: true });
      expect(r.text).toBe('Done');
    });
  });

  describe('correction mode', () => {
    it('starts with "Applying correction"', () => {
      const r = computeAnalyzeLabel({ mode: 'correction', partialText: '', complete: false });
      expect(r.text).toBe('Applying correction');
    });

    it('switches to "Found N items" once items stream', () => {
      const r = computeAnalyzeLabel({
        mode: 'correction',
        partialText: '{"name": "T", "items": ["A"',
        complete: false,
      });
      expect(r.text).toBe('Found 1 item');
    });
  });

  describe('idle mode', () => {
    it('returns empty label and no ellipsis', () => {
      const r = computeAnalyzeLabel({ mode: 'idle', partialText: '', complete: false });
      expect(r.text).toBe('');
      expect(r.showEllipsis).toBe(false);
    });
  });
});
