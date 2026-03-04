import { describe, expect, it } from 'vitest';
import { parsePartialAnalysis } from '../parsePartialAnalysis';

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
