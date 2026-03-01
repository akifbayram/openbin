import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetForTest, getEntries, pushLog, subscribe, unsubscribe } from '../logBuffer.js';

afterEach(() => {
  _resetForTest();
});

describe('logBuffer', () => {
  it('pushLog adds an entry and getEntries returns it', () => {
    pushLog({ level: 'info', message: 'hello' });
    const entries = getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('info');
    expect(entries[0].message).toBe('hello');
    expect(entries[0].id).toBe(1);
    expect(entries[0].timestamp).toBeDefined();
  });

  it('assigns auto-incrementing ids', () => {
    pushLog({ level: 'info', message: 'a' });
    pushLog({ level: 'warn', message: 'b' });
    const entries = getEntries();
    expect(entries[0].id).toBeLessThan(entries[1].id);
  });

  it('getEntries(sinceId) returns only newer entries', () => {
    pushLog({ level: 'info', message: 'first' });
    pushLog({ level: 'info', message: 'second' });
    const all = getEntries();
    const firstId = all[0].id;
    const newer = getEntries(firstId);
    expect(newer).toHaveLength(1);
    expect(newer[0].message).toBe('second');
  });

  it('evicts oldest entries when buffer is full', () => {
    for (let i = 0; i < 1005; i++) {
      pushLog({ level: 'info', message: `msg-${i}` });
    }
    const entries = getEntries();
    expect(entries.length).toBe(1000);
    expect(entries[0].message).toBe('msg-5');
    expect(entries[entries.length - 1].message).toBe('msg-1004');
  });

  it('notifies subscribers on pushLog', () => {
    const cb = vi.fn();
    subscribe(cb);
    pushLog({ level: 'error', message: 'boom' });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ level: 'error', message: 'boom' }));
    unsubscribe(cb);
  });

  it('unsubscribe stops notifications', () => {
    const cb = vi.fn();
    subscribe(cb);
    unsubscribe(cb);
    pushLog({ level: 'info', message: 'ignored' });
    expect(cb).not.toHaveBeenCalled();
  });
});
