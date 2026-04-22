import { describe, expect, it } from 'vitest';
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
