import { describe, expect, it } from 'vitest';
import {
  buildHistoryPayload,
  createTurnId,
  type Turn,
} from '../conversationTurns';
import type { CommandAction } from '../useCommand';

describe('createTurnId', () => {
  it('returns a unique id on each call', () => {
    const a = createTurnId();
    const b = createTurnId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^t_/);
  });
});

describe('buildHistoryPayload', () => {
  it('excludes thinking and error turns', () => {
    const turns: Turn[] = [
      { kind: 'user-text', id: 't1', text: 'hi', createdAt: 0 },
      { kind: 'ai-thinking', id: 't2', phase: 'parsing' },
      { kind: 'ai-error', id: 't3', error: 'boom', canRetry: true },
    ];
    expect(buildHistoryPayload(turns)).toEqual([
      { role: 'user', content: 'hi' },
    ]);
  });

  it('includes query-result turns as assistant answers', () => {
    const turns: Turn[] = [
      { kind: 'user-text', id: 't1', text: 'find', createdAt: 0 },
      {
        kind: 'ai-query-result',
        id: 't2',
        queryResult: {
          answer: 'over there',
          matches: [{ bin_id: 'b1', name: 'Bin', area_name: '', items: [], total_item_count: 0, tags: [], relevance: '', icon: '', color: '' }],
        },
      },
    ];
    const payload = buildHistoryPayload(turns);
    expect(payload).toHaveLength(2);
    expect(payload[1]).toEqual({
      role: 'assistant',
      kind: 'answer',
      content: 'over there',
      matchedBinIds: ['b1'],
    });
  });

  it('includes executed command-preview turns with executedActionIndices and failedCount', () => {
    const actionA: CommandAction = { type: 'create_bin', name: 'X' } as CommandAction;
    const actionB: CommandAction = { type: 'create_bin', name: 'Y' } as CommandAction;
    const turns: Turn[] = [
      { kind: 'user-text', id: 't1', text: 'create', createdAt: 0 },
      {
        kind: 'ai-command-preview',
        id: 't2',
        actions: [actionA, actionB],
        interpretation: 'Create two bins',
        checkedActions: new Map([[0, true], [1, true]]),
        status: 'executed',
        executionResult: {
          completedActions: [actionA],
          completedActionIndices: [0],
          createdBins: [],
          failedCount: 1,
        },
      },
    ];
    const payload = buildHistoryPayload(turns);
    expect(payload[1]).toMatchObject({
      role: 'assistant',
      kind: 'command',
      interpretation: 'Create two bins',
      executed: true,
      executedActionIndices: [0],
      failedCount: 1,
    });
    // No more placeholder executionErrors array — failedCount replaces it
    expect(payload[1]).not.toHaveProperty('executionErrors');
  });

  it('includes pending command-preview turns as unexecuted', () => {
    const turns: Turn[] = [
      { kind: 'user-text', id: 't1', text: 'do it', createdAt: 0 },
      {
        kind: 'ai-command-preview',
        id: 't2',
        actions: [{ type: 'delete_bin' } as unknown as CommandAction],
        interpretation: 'Delete',
        checkedActions: new Map([[0, true]]),
        status: 'pending',
      },
    ];
    const payload = buildHistoryPayload(turns);
    expect(payload[1]).toMatchObject({ role: 'assistant', kind: 'command', executed: false });
    // No executionErrors when never executed
    expect(payload[1]).not.toHaveProperty('executionErrors');
  });
});
