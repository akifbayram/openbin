import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useDrawer, DrawerProvider } from '../DrawerContext';

describe('useDrawer', () => {
  it('throws when used outside provider', () => {
    // Suppress expected error log from React
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useDrawer())).toThrow(
      'useDrawer must be used within DrawerProvider',
    );

    spy.mockRestore();
  });

  it('returns openDrawer and isOnboarding', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DrawerProvider isOnboarding={false} onOpen={vi.fn()}>
        {children}
      </DrawerProvider>
    );

    const { result } = renderHook(() => useDrawer(), { wrapper });

    expect(result.current).toHaveProperty('openDrawer');
    expect(result.current).toHaveProperty('isOnboarding');
    expect(typeof result.current.openDrawer).toBe('function');
    expect(result.current.isOnboarding).toBe(false);
  });

  it('openDrawer calls onOpen callback', () => {
    const mockOnOpen = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DrawerProvider isOnboarding={false} onOpen={mockOnOpen}>
        {children}
      </DrawerProvider>
    );

    const { result } = renderHook(() => useDrawer(), { wrapper });

    act(() => {
      result.current.openDrawer();
    });

    expect(mockOnOpen).toHaveBeenCalledTimes(1);
  });
});
