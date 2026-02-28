import { useEffect, useRef } from 'react';

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

interface Options {
  actions: Record<string, () => void>;
  enabled?: boolean;
}

export function useKeyboardShortcuts({ actions, enabled = true }: Options) {
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  const prefixRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    function clearPrefix() {
      prefixRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      const acts = actionsRef.current;
      const editable = isEditableTarget(e.target);

      // mod+k always fires (even in inputs)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        acts['command-palette']?.();
        clearPrefix();
        return;
      }

      // Skip all other shortcuts when focused in an editable element
      if (editable) return;

      // Skip when any modifier is held (except shift for ?)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // g prefix sequence
      if (prefixRef.current === 'g') {
        clearPrefix();
        // Map single-letter to navigation ID
        const navMap: Record<string, string> = {
          h: 'go-home',
          b: 'go-bins',
          s: 'go-scan',
          p: 'go-print',
          l: 'go-locations',
          i: 'go-items',
          t: 'go-tags',
          e: 'go-settings',
        };
        const actionId = navMap[e.key];
        if (actionId && acts[actionId]) {
          e.preventDefault();
          acts[actionId]();
        }
        return;
      }

      // Start g prefix
      if (e.key === 'g') {
        prefixRef.current = 'g';
        timerRef.current = setTimeout(clearPrefix, 800);
        return;
      }

      // ? shortcut
      if (e.key === '?') {
        e.preventDefault();
        acts['shortcuts-help']?.();
        return;
      }

      // Single-key shortcuts
      if (e.key === 'n') {
        e.preventDefault();
        acts['new-bin']?.();
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        acts['focus-search']?.();
        return;
      }

      if (e.key === '[') {
        e.preventDefault();
        acts['toggle-sidebar']?.();
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearPrefix();
    };
  }, [enabled]);
}
