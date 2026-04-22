import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEntitySelectionInteraction } from './useEntitySelectionInteraction';

describe('useEntitySelectionInteraction', () => {
  it('handleClick calls onActivate when not in selection mode', () => {
    const onSelect = vi.fn();
    const onActivate = vi.fn();
    const { result } = renderHook(() =>
      useEntitySelectionInteraction({ id: 'a', index: 0, selectable: false, onSelect, onActivate }),
    );
    act(() => result.current.handleClick({ shiftKey: false } as React.MouseEvent));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('handleClick calls onSelect when selectable', () => {
    const onSelect = vi.fn();
    const onActivate = vi.fn();
    const { result } = renderHook(() =>
      useEntitySelectionInteraction({ id: 'a', index: 0, selectable: true, onSelect, onActivate }),
    );
    act(() => result.current.handleClick({ shiftKey: true } as React.MouseEvent));
    expect(onSelect).toHaveBeenCalledWith('a', 0, true);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('handleKeyDown on Enter routes to onSelect when selectable', () => {
    const onSelect = vi.fn();
    const onActivate = vi.fn();
    const { result } = renderHook(() =>
      useEntitySelectionInteraction({ id: 'a', index: 0, selectable: true, onSelect, onActivate }),
    );
    act(() => result.current.handleKeyDown({ key: 'Enter' } as React.KeyboardEvent));
    expect(onSelect).toHaveBeenCalledWith('a', 0, false);
  });

  it('handleKeyDown on Enter routes to onActivate when not selectable', () => {
    const onSelect = vi.fn();
    const onActivate = vi.fn();
    const { result } = renderHook(() =>
      useEntitySelectionInteraction({ id: 'a', index: 0, selectable: false, onSelect, onActivate }),
    );
    act(() => result.current.handleKeyDown({ key: 'Enter' } as React.KeyboardEvent));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('handleClick is a no-op when long press just fired', () => {
    const onSelect = vi.fn();
    const onActivate = vi.fn();
    const { result } = renderHook(() =>
      useEntitySelectionInteraction({ id: 'a', index: 0, selectable: false, onSelect, onActivate }),
    );
    // Simulate the long press having just fired
    (result.current.didLongPress as { current: boolean }).current = true;
    act(() => result.current.handleClick({ shiftKey: false } as React.MouseEvent));
    expect(onActivate).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('long-press triggers onSelect with shiftKey=false when not yet selectable', () => {
    const onSelect = vi.fn();
    const onActivate = vi.fn();
    const { result } = renderHook(() =>
      useEntitySelectionInteraction({ id: 'a', index: 0, selectable: false, onSelect, onActivate }),
    );
    // The longPress handler exposed on the result is the one returned by useLongPress;
    // exercising it via onContextMenu (the desktop entry) is the simplest deterministic path.
    act(() => result.current.longPress.onContextMenu({ preventDefault: () => {} } as React.MouseEvent));
    expect(onSelect).toHaveBeenCalledWith('a', 0, false);
  });
});
