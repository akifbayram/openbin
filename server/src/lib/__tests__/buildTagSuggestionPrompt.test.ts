import { describe, expect, it } from 'vitest';
import { buildTagSuggestionPrompt } from '../buildTagSuggestionPrompt.js';

describe('buildTagSuggestionPrompt', () => {
  const baseArgs = {
    inputBins: [
      { id: 'bin-1', name: 'Kitchen Tools', items: ['Whisk', 'Spatula'], tags: ['utensils'], areaName: 'Kitchen' },
    ],
    availableTags: [
      { tag: 'utensils', parent: null },
      { tag: 'tools', parent: null },
    ],
    changeLevel: 'additive' as const,
    granularity: 'medium' as const,
    demo: false,
  };

  it('injects additive change-level instruction', () => {
    const { system } = buildTagSuggestionPrompt(baseArgs);
    expect(system).toContain('Change level: BASIC');
    expect(system).toContain('You MUST leave renames, merges, and parents arrays empty');
    expect(system).toContain('remove tags from bins when they are clearly wrong');
  });

  it('injects moderate change-level instruction', () => {
    const { system } = buildTagSuggestionPrompt({ ...baseArgs, changeLevel: 'moderate' });
    expect(system).toContain('Change level: MODERATE');
    expect(system).toContain('add or remove tags on bins');
  });

  it('injects full change-level instruction', () => {
    const { system } = buildTagSuggestionPrompt({ ...baseArgs, changeLevel: 'full' });
    expect(system).toContain('Change level: FULL');
  });

  it('injects broad granularity', () => {
    const { system } = buildTagSuggestionPrompt({ ...baseArgs, granularity: 'broad' });
    expect(system).toContain('broad, top-level tags');
  });

  it('injects specific granularity', () => {
    const { system } = buildTagSuggestionPrompt({ ...baseArgs, granularity: 'specific' });
    expect(system).toContain('narrow, specific tags');
  });

  it('sets tag count when maxTagsPerBin provided', () => {
    const { system } = buildTagSuggestionPrompt({ ...baseArgs, maxTagsPerBin: 5 });
    expect(system).toContain('Apply at most 5 tags per bin');
  });

  it('falls back to soft count when maxTagsPerBin absent', () => {
    const { system } = buildTagSuggestionPrompt(baseArgs);
    expect(system).toContain('2-4 for most bins');
  });

  it('sanitizes and wraps userNotes', () => {
    const { system } = buildTagSuggestionPrompt({ ...baseArgs, userNotes: 'keep kitchen separate' });
    expect(system).toContain('Additional user preferences');
    expect(system).toContain('keep kitchen separate');
  });

  it('omits notes block when userNotes empty', () => {
    const { system } = buildTagSuggestionPrompt(baseArgs);
    expect(system).not.toContain('Additional user preferences');
  });

  it('lists available tags in user content with parent annotation', () => {
    const args = {
      ...baseArgs,
      availableTags: [{ tag: 'hand-tools', parent: 'tools' }, { tag: 'tools', parent: null }],
    };
    const { userContent } = buildTagSuggestionPrompt(args);
    expect(userContent).toContain('<available_tags>');
    expect(userContent).toContain('hand-tools (parent: tools)');
    expect(userContent).toContain('tools');
  });

  it('formats each bin with binId, name, area, items, existing tags', () => {
    const { userContent } = buildTagSuggestionPrompt(baseArgs);
    expect(userContent).toContain('binId: bin-1');
    expect(userContent).toContain('name: Kitchen Tools');
    expect(userContent).toContain('area: Kitchen');
    expect(userContent).toContain('existing tags: utensils');
    expect(userContent).toContain('items: Whisk, Spatula');
  });

  it('uses "(empty)" for bins with no items', () => {
    const args = { ...baseArgs, inputBins: [{ id: 'b', name: 'Empty', items: [], tags: [], areaName: null }] };
    expect(buildTagSuggestionPrompt(args).userContent).toContain('items: (empty)');
  });

  it('uses "(none)" for bins with no area', () => {
    const args = { ...baseArgs, inputBins: [{ id: 'b', name: 'X', items: ['Y'], tags: [], areaName: null }] };
    expect(buildTagSuggestionPrompt(args).userContent).toContain('area: (none)');
  });

  it('applies prompt override for non-demo users', () => {
    const { system } = buildTagSuggestionPrompt({ ...baseArgs, promptOverride: 'CUSTOM {change_level_instruction}' });
    expect(system).toContain('CUSTOM');
    expect(system).toContain('Change level: BASIC');
  });

  it('ignores prompt override for demo users', () => {
    const { system } = buildTagSuggestionPrompt({ ...baseArgs, promptOverride: 'CUSTOM', demo: true });
    expect(system).not.toContain('CUSTOM');
  });
});
