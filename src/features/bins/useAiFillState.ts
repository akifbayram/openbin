import { useCallback, useRef, useState } from 'react';
import type { BinItem } from '@/types';

export type AiFillField = 'name' | 'items';

export interface AiFillSnapshot {
  name: string;
  items: BinItem[];
}

/**
 * State machine for the "AI just filled this field" affordance: tracks which
 * fields were AI-filled, snapshots their pre-AI values for undo, and bumps a
 * cycle counter so callers can use it as a React `key` to replay the
 * `ai-field-fill` CSS animation when the AI re-runs.
 *
 * The hook owns no business state — callers stay responsible for applying
 * snapshots back to their own form state on undo.
 */
export function useAiFillState() {
  const [filled, setFilled] = useState<Set<AiFillField>>(() => new Set());
  const [cycle, setCycle] = useState(0);
  const snapshotRef = useRef<AiFillSnapshot | null>(null);

  const snapshot = useCallback((values: AiFillSnapshot) => {
    snapshotRef.current = { name: values.name, items: values.items };
  }, []);

  const markFilled = useCallback((fields: Iterable<AiFillField>) => {
    setFilled(new Set(fields));
    setCycle((c) => c + 1);
  }, []);

  const undo = useCallback((field: AiFillField): AiFillSnapshot | null => {
    const snap = snapshotRef.current;
    if (!snap) return null;
    setFilled((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
    return snap;
  }, []);

  const reset = useCallback(() => {
    setFilled(new Set());
    snapshotRef.current = null;
  }, []);

  const keyFor = (field: AiFillField) =>
    filled.has(field) ? `${field}-${cycle}` : field;

  const styleFor = (field: AiFillField, stagger: number): React.CSSProperties | undefined =>
    filled.has(field) ? ({ '--stagger': stagger } as React.CSSProperties) : undefined;

  return { filled, snapshot, markFilled, undo, reset, keyFor, styleFor };
}
