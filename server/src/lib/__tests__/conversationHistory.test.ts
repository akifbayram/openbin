import { describe, expect, it } from 'vitest';
import {
  type ConversationTurn,
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

  it('includes "N failed" suffix when executionErrors is non-empty', () => {
    const msgs = toProviderMessages([
      {
        role: 'assistant',
        kind: 'command',
        interpretation: 'Delete bins',
        actions: [{}, {}, {}],
        executed: true,
        executedActionIndices: [0, 1, 2],
        executionErrors: ['bin not found'],
      },
    ]);
    expect(msgs[0].content).toMatch(/3 actions \(1 failed\)/);
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

  it('falls back to executionErrors.length when failedCount is absent', () => {
    const msgs = toProviderMessages([
      {
        role: 'assistant',
        kind: 'command',
        interpretation: 'Delete',
        actions: [{}],
        executed: true,
        executedActionIndices: [0],
        executionErrors: ['x'],
      },
    ]);
    expect(msgs[0].content).toMatch(/\(1 failed\)/);
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
});
