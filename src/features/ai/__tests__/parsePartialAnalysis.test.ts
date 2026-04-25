import { describe, expect, it } from 'vitest';
import { parseAnalysisItemCount, parsePartialAnalysis } from '../parsePartialAnalysis';

describe('parsePartialAnalysis', () => {
  it('returns empty name and items for empty string', () => {
    expect(parsePartialAnalysis('')).toEqual({ name: '', items: [] });
  });

  it('returns empty for opening brace only', () => {
    expect(parsePartialAnalysis('{')).toEqual({ name: '', items: [] });
  });

  it('extracts name only', () => {
    const text = '{"name": "Holiday Decorations"';
    expect(parsePartialAnalysis(text)).toEqual({ name: 'Holiday Decorations', items: [] });
  });

  it('extracts name with escaped quotes', () => {
    const text = '{"name": "Box \\"A\\"", "items"';
    expect(parsePartialAnalysis(text)).toEqual({ name: 'Box "A"', items: [] });
  });

  it('extracts name with escaped backslash', () => {
    const text = '{"name": "C:\\\\Users\\\\Docs"';
    expect(parsePartialAnalysis(text)).toEqual({ name: 'C:\\Users\\Docs', items: [] });
  });

  it('returns empty items when items array not started', () => {
    const text = '{"name": "Toolbox", "ite';
    expect(parsePartialAnalysis(text)).toEqual({ name: 'Toolbox', items: [] });
  });

  it('returns empty items when bracket not opened', () => {
    const text = '{"name": "Toolbox", "items":';
    expect(parsePartialAnalysis(text)).toEqual({ name: 'Toolbox', items: [] });
  });

  it('extracts partial items (no closing bracket)', () => {
    const text = '{"name": "Toolbox", "items": ["Hammer", "Nails"';
    expect(parsePartialAnalysis(text)).toEqual({
      name: 'Toolbox',
      items: ['Hammer', 'Nails'],
    });
  });

  it('extracts complete items array', () => {
    const text = '{"name": "Toolbox", "items": ["Hammer", "Nails", "Screws"], "tags"';
    expect(parsePartialAnalysis(text)).toEqual({
      name: 'Toolbox',
      items: ['Hammer', 'Nails', 'Screws'],
    });
  });

  it('ignores incomplete item string', () => {
    const text = '{"name": "Box", "items": ["Done item", "Partial ite';
    expect(parsePartialAnalysis(text)).toEqual({
      name: 'Box',
      items: ['Done item'],
    });
  });

  it('handles items with special characters', () => {
    const text = '{"name": "Kitchen", "items": ["Knife (8\\")", "Bowl / Plate"]';
    expect(parsePartialAnalysis(text)).toEqual({
      name: 'Kitchen',
      items: ['Knife (8")', 'Bowl / Plate'],
    });
  });

  it('handles complete JSON', () => {
    const text = '{"name":"Storage","items":["Books","Pens"],"tags":["office"],"notes":"Desk items"}';
    expect(parsePartialAnalysis(text)).toEqual({
      name: 'Storage',
      items: ['Books', 'Pens'],
    });
  });

  it('handles name with no space after colon', () => {
    const text = '{"name":"Compact"}';
    expect(parsePartialAnalysis(text)).toEqual({ name: 'Compact', items: [] });
  });

  it('handles empty items array', () => {
    const text = '{"name": "Empty", "items": []}';
    expect(parsePartialAnalysis(text)).toEqual({ name: 'Empty', items: [] });
  });
});

describe('parseAnalysisItemCount', () => {
  it('returns 0 for empty string', () => {
    expect(parseAnalysisItemCount('')).toBe(0);
  });

  it('returns 0 when only name parsed (no items array yet)', () => {
    expect(parseAnalysisItemCount('{"name": "Holiday Decorations"')).toBe(0);
  });

  it('returns 0 for empty items array', () => {
    expect(parseAnalysisItemCount('{"name": "Empty", "items": []}')).toBe(0);
  });

  it('returns 1 when one complete item', () => {
    expect(parseAnalysisItemCount('{"name": "Box", "items": ["Hammer"')).toBe(1);
  });

  it('returns N for N complete items', () => {
    const text = '{"name": "Box", "items": ["A", "B", "C", "D", "E"';
    expect(parseAnalysisItemCount(text)).toBe(5);
  });

  it('does not count a truncated mid-string item', () => {
    expect(parseAnalysisItemCount('{"name": "Box", "items": ["Done", "Partial ite')).toBe(1);
  });

  it('counts items in object format', () => {
    const text = '{"name": "Box", "items": [{"name": "A"}, {"name": "B"}';
    expect(parseAnalysisItemCount(text)).toBe(2);
  });
});
