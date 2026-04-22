import { describe, expect, it } from 'vitest';
import { REORGANIZE_FORMAT_SUFFIX } from '../lib/defaultPrompts.js';
import { buildReorganizePrompt } from '../lib/reorganizePrompt.js';

describe('buildReorganizePrompt — name reuse guidance', () => {
  it('includes the "PREFER reusing existing input bin names" instruction in the system prompt', () => {
    const result = buildReorganizePrompt({
      inputBins: [{ name: 'Board Games', items: ['Monopoly', 'Uno'], tags: [] }],
      demo: false,
    });
    expect(result.system).toContain('PREFER reusing existing input bin names');
  });

  it('system prompt explains both reuse conditions (dominant source) and new-name conditions (merge, inaccurate name)', () => {
    const result = buildReorganizePrompt({
      inputBins: [{ name: 'Board Games', items: ['Monopoly'], tags: [] }],
      demo: false,
    });
    // Dominant-source reuse cue
    expect(result.system).toContain('primarily from a single input bin');
    // Merge cue (new name warranted)
    expect(result.system).toMatch(/merges items from multiple sources/);
    // Inaccurate-name cue (new name warranted)
    expect(result.system).toMatch(/clearly inaccurate for the new contents/);
  });

  it('includes the paired good/bad examples so Gemini-style models keep the instruction in attention', () => {
    const result = buildReorganizePrompt({
      inputBins: [{ name: 'Board Games', items: ['Monopoly'], tags: [] }],
      demo: false,
    });
    expect(result.system).toContain('Good:');
    expect(result.system).toContain('Bad:');
    expect(result.system).toContain('Family Board Games');
  });

  it('honors reorganizationPromptOverride — custom prompts replace the default rule set', () => {
    const result = buildReorganizePrompt({
      inputBins: [{ name: 'A', items: ['x'], tags: [] }],
      reorganizationPromptOverride: 'custom reorg instructions',
      demo: false,
    });
    expect(result.system).toContain('custom reorg instructions');
    // The reuse instruction is part of the DEFAULT prompt, so an override drops it.
    expect(result.system).not.toContain('PREFER reusing existing input bin names');
  });
});

describe('buildReorganizePrompt — numbered input format', () => {
  it('emits a globally-numbered items block grouped by source bin', () => {
    const result = buildReorganizePrompt({
      inputBins: [
        { name: 'Garage A', items: ['Hammer', 'Nails'], tags: [] },
        { name: 'Garage B', items: ['Drill', 'Bits', 'Screws'], tags: [] },
      ],
      demo: false,
    });
    expect(result.userContent).toContain('Bin "Garage A":');
    expect(result.userContent).toContain('1. Hammer');
    expect(result.userContent).toContain('2. Nails');
    expect(result.userContent).toContain('Bin "Garage B":');
    expect(result.userContent).toContain('3. Drill');
    expect(result.userContent).toContain('4. Bits');
    expect(result.userContent).toContain('5. Screws');
  });

  it('reports totalInputItems correctly across multiple bins', () => {
    const result = buildReorganizePrompt({
      inputBins: [
        { name: 'A', items: ['x', 'y'], tags: [] },
        { name: 'B', items: ['z'], tags: [] },
      ],
      demo: false,
    });
    expect(result.totalInputItems).toBe(3);
    expect(result.userContent).toContain('3 items total');
  });

  it('tells the AI to use numbers in output, not text', () => {
    const result = buildReorganizePrompt({
      inputBins: [{ name: 'A', items: ['x'], tags: [] }],
      demo: false,
    });
    expect(result.userContent).toMatch(/numbers|Items are numbered/i);
  });
});

describe('buildReorganizePrompt — forced format suffix', () => {
  it('appends REORGANIZE_FORMAT_SUFFIX to the system prompt when using the default prompt', () => {
    const result = buildReorganizePrompt({
      inputBins: [{ name: 'A', items: ['x'], tags: [] }],
      demo: false,
    });
    expect(result.system).toContain(REORGANIZE_FORMAT_SUFFIX);
  });

  it('appends REORGANIZE_FORMAT_SUFFIX even when a custom override replaces the default prompt', () => {
    const result = buildReorganizePrompt({
      inputBins: [{ name: 'A', items: ['x'], tags: [] }],
      reorganizationPromptOverride: 'custom reorg instructions',
      demo: false,
    });
    expect(result.system).toContain('custom reorg instructions');
    expect(result.system).toContain(REORGANIZE_FORMAT_SUFFIX);
  });

  it('places the suffix at the end of the system prompt', () => {
    const result = buildReorganizePrompt({
      inputBins: [{ name: 'A', items: ['x'], tags: [] }],
      demo: false,
    });
    expect(result.system.endsWith(REORGANIZE_FORMAT_SUFFIX)).toBe(true);
  });
});
