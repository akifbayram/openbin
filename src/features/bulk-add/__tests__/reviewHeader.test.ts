import { describe, expect, it } from 'vitest';
import { computeReviewHeader } from '../reviewHeader';

const term = { bin: 'bin', Bin: 'Bin' };

describe('computeReviewHeader', () => {
  describe('single bin', () => {
    it('says "Analyzing your photo" for 1 photo, analyzing', () => {
      const r = computeReviewHeader({
        groupCount: 1,
        currentIndex: 0,
        photoCount: 1,
        editingFromSummary: false,
        isAnalyzing: true,
        term,
      });
      expect(r.title).toBe('Analyzing your photo');
    });

    it('pluralizes to "Analyzing your photos" for 2+ photos, analyzing', () => {
      const r = computeReviewHeader({
        groupCount: 1,
        currentIndex: 0,
        photoCount: 3,
        editingFromSummary: false,
        isAnalyzing: true,
        term,
      });
      expect(r.title).toBe('Analyzing your photos');
    });

    it('says "Review bin" once analysis is done', () => {
      const r = computeReviewHeader({
        groupCount: 1,
        currentIndex: 0,
        photoCount: 1,
        editingFromSummary: false,
        isAnalyzing: false,
        term,
      });
      expect(r.title).toBe('Review bin');
    });

    it('uses the custom term when provided', () => {
      const r = computeReviewHeader({
        groupCount: 1,
        currentIndex: 0,
        photoCount: 1,
        editingFromSummary: false,
        isAnalyzing: false,
        term: { bin: 'box', Bin: 'Box' },
      });
      expect(r.title).toBe('Review box');
    });
  });

  describe('multi-bin', () => {
    it('says "Analyzing bin 3" for the 3rd group of 5 during analysis', () => {
      const r = computeReviewHeader({
        groupCount: 5,
        currentIndex: 2,
        photoCount: 1,
        editingFromSummary: false,
        isAnalyzing: true,
        term,
      });
      expect(r.title).toBe('Analyzing bin 3');
    });

    it('says "Review bin 3" for the 3rd group of 5 after analysis', () => {
      const r = computeReviewHeader({
        groupCount: 5,
        currentIndex: 2,
        photoCount: 1,
        editingFromSummary: false,
        isAnalyzing: false,
        term,
      });
      expect(r.title).toBe('Review bin 3');
    });
  });

  describe('editing from summary', () => {
    it('says "Edit bin"', () => {
      const r = computeReviewHeader({
        groupCount: 5,
        currentIndex: 2,
        photoCount: 1,
        editingFromSummary: true,
        isAnalyzing: false,
        term,
      });
      expect(r.title).toBe('Edit bin');
    });

    it('does not switch to "Analyzing" even when reanalyze is running', () => {
      const r = computeReviewHeader({
        groupCount: 5,
        currentIndex: 2,
        photoCount: 1,
        editingFromSummary: true,
        isAnalyzing: true,
        term,
      });
      expect(r.title).toBe('Edit bin');
    });
  });

  describe('subtitle', () => {
    it('is null during analysis', () => {
      const r = computeReviewHeader({
        groupCount: 1,
        currentIndex: 0,
        photoCount: 1,
        editingFromSummary: false,
        isAnalyzing: true,
        term,
      });
      expect(r.subtitle).toBeNull();
    });

    it('is "Tap any field to edit" once analysis is done', () => {
      const r = computeReviewHeader({
        groupCount: 1,
        currentIndex: 0,
        photoCount: 1,
        editingFromSummary: false,
        isAnalyzing: false,
        term,
      });
      expect(r.subtitle).toBe('Tap any field to edit');
    });

    it('is "Tap any field to edit" when editing from summary', () => {
      const r = computeReviewHeader({
        groupCount: 1,
        currentIndex: 0,
        photoCount: 1,
        editingFromSummary: true,
        isAnalyzing: false,
        term,
      });
      expect(r.subtitle).toBe('Tap any field to edit');
    });
  });
});
