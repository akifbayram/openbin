import { describe, expect, it } from 'vitest';
import {
  type ConversationTurn,
  MAX_TOTAL_CHARS,
  MAX_TURN_CHARS,
  MAX_TURNS,
  parseHistoryFromBody,
  toProviderMessages,
  trimHistory,
} from '../conversationHistory.js';

describe('trimHistory', () => {
  it('returns history unchanged when within limit', () => {
    const history: ConversationTurn[] = [
      { role: 'user', content: 'first' },
      { role: 'assistant', kind: 'answer', content: 'reply' },
    ];
    expect(trimHistory(history)).toEqual(history);
  });

  it('keeps only the last MAX_TURNS entries', () => {
    const history: ConversationTurn[] = Array.from(
      { length: MAX_TURNS + 5 },
      (_, i): ConversationTurn =>
        i % 2 === 0
          ? { role: 'user', content: `u${i}` }
          : { role: 'assistant', kind: 'answer', content: `a${i}` },
    );
    const trimmed = trimHistory(history);
    expect(trimmed.length).toBe(MAX_TURNS);
    expect(trimmed[0]).toBe(history[5]);
    expect(trimmed[trimmed.length - 1]).toBe(history[history.length - 1]);
  });

  it('returns empty array when input is undefined', () => {
    expect(trimHistory(undefined)).toEqual([]);
  });
});

describe('toProviderMessages', () => {
  it('maps user turns to role: user', () => {
    const msgs = toProviderMessages([{ role: 'user', content: 'find the wrench' }]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual({ role: 'user', content: 'find the wrench' });
  });

  it('maps assistant answer turns to role: assistant with plain content', () => {
    const msgs = toProviderMessages([
      { role: 'assistant', kind: 'answer', content: 'Wrench is in the toolbox.' },
    ]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual({ role: 'assistant', content: 'Wrench is in the toolbox.' });
  });

  it('compacts executed command turns into a natural-language summary', () => {
    const msgs = toProviderMessages([
      {
        role: 'assistant',
        kind: 'command',
        interpretation: 'Create a new bin',
        actions: [{ type: 'create_bin', name: 'Shed tools' }],
        executed: true,
        executedActionIndices: [0],
      },
    ]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('assistant');
    expect(msgs[0].content).toMatch(/Executed.*Create a new bin/i);
  });

  it('compacts unexecuted command turns to indicate they were proposed but canceled', () => {
    const msgs = toProviderMessages([
      {
        role: 'assistant',
        kind: 'command',
        interpretation: 'Delete three bins',
        actions: [{ type: 'delete_bin' }, { type: 'delete_bin' }, { type: 'delete_bin' }],
        executed: false,
      },
    ]);
    expect(msgs[0].content).toMatch(/proposed.*Delete three bins/i);
  });

  it('preserves ordering across multiple turns', () => {
    const msgs = toProviderMessages([
      { role: 'user', content: 'hi' },
      { role: 'assistant', kind: 'answer', content: 'hello' },
      { role: 'user', content: 'where are tools' },
    ]);
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('uses failedCount for the "N failed" suffix when present', () => {
    const msgs = toProviderMessages([
      {
        role: 'assistant',
        kind: 'command',
        interpretation: 'Delete bins',
        actions: [{}, {}, {}],
        executed: true,
        executedActionIndices: [0, 1, 2],
        failedCount: 2,
      },
    ]);
    expect(msgs[0].content).toMatch(/3 actions \(2 failed\)/);
  });

  it('omits the em-dash action-count suffix when interpretation is empty', () => {
    const msgs = toProviderMessages([
      {
        role: 'assistant',
        kind: 'command',
        interpretation: '',
        actions: [{}, {}],
        executed: true,
        executedActionIndices: [0, 1],
      },
    ]);
    // Should NOT contain an em dash followed by "2 actions" (that would indicate duplication)
    expect(msgs[0].content).toBe('Executed: 2 actions.');
  });
});

describe('parseHistoryFromBody', () => {
  it('returns [] when body has no history field', () => {
    expect(parseHistoryFromBody({})).toEqual([]);
  });

  it('returns [] when history is not an array', () => {
    expect(parseHistoryFromBody({ history: 'oops' })).toEqual([]);
    expect(parseHistoryFromBody({ history: null })).toEqual([]);
  });

  it('returns [] when body is null or undefined', () => {
    expect(parseHistoryFromBody(null)).toEqual([]);
    expect(parseHistoryFromBody(undefined)).toEqual([]);
  });

  it('maps a valid user + answer history to provider messages', () => {
    const msgs = parseHistoryFromBody({
      history: [
        { role: 'user', content: 'find tape' },
        { role: 'assistant', kind: 'answer', content: 'in drawer' },
      ],
    });
    expect(msgs).toEqual([
      { role: 'user', content: 'find tape' },
      { role: 'assistant', content: 'in drawer' },
    ]);
  });

  it('drops malformed turns but keeps the valid ones in order', () => {
    const msgs = parseHistoryFromBody({
      history: [
        { role: 'user', content: 'first' },
        { role: 'admin', content: 'nope' }, // invalid role
        { role: 'assistant', kind: 'answer' }, // missing content
        { role: 'user', content: 'second' },
      ],
    });
    expect(msgs).toEqual([
      { role: 'user', content: 'first' },
      { role: 'user', content: 'second' },
    ]);
  });

  it('accepts valid command turns', () => {
    const msgs = parseHistoryFromBody({
      history: [
        {
          role: 'assistant',
          kind: 'command',
          interpretation: 'Create bin',
          actions: [{ type: 'create_bin' }],
          executed: true,
          executedActionIndices: [0],
        },
      ],
    });
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toMatch(/Executed.*Create bin/);
  });

  it('drops turns whose textual content exceeds MAX_TURN_CHARS', () => {
    const validUserContent = 'a'.repeat(100);
    const oversizedContent = 'x'.repeat(MAX_TURN_CHARS + 1);
    const body = {
      history: [
        { role: 'user', content: validUserContent },
        { role: 'user', content: oversizedContent },
        { role: 'assistant', kind: 'answer', content: oversizedContent },
        {
          role: 'assistant',
          kind: 'command',
          interpretation: oversizedContent,
          actions: [],
          executed: true,
        },
      ],
    };

    const result = parseHistoryFromBody(body);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: 'user', content: validUserContent });
  });

  it('trims oldest turns when total content chars exceed MAX_TOTAL_CHARS', () => {
    const turnSize = 4000;
    const filler = 'x'.repeat(turnSize - 4);
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: 'user' as const,
      content: `t${String(i).padStart(2, '0')}:${filler}`,
    }));

    const result = parseHistoryFromBody({ history });

    expect(result).toHaveLength(8);
    expect(result.length * turnSize).toBeLessThanOrEqual(MAX_TOTAL_CHARS);

    const keptPrefixes = result.map((m) => (m.content as string).slice(0, 4));
    expect(keptPrefixes).toEqual([
      't02:',
      't03:',
      't04:',
      't05:',
      't06:',
      't07:',
      't08:',
      't09:',
    ]);

    for (const msg of result) {
      expect(msg.content as string).not.toMatch(/^t00:/);
      expect(msg.content as string).not.toMatch(/^t01:/);
    }
  });
});
