import { useState, useCallback, useRef, useEffect } from 'react';

type AnimatingState = 'enter' | 'exit' | null;

interface UsePopoverReturn {
  /** Whether the popover DOM should be mounted */
  visible: boolean;
  /** Current animation phase */
  animating: AnimatingState;
  /** Convenience: true when popover is logically open */
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const EXIT_DURATION = 120;

export function usePopover(): UsePopoverReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState<AnimatingState>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => { clearTimeout(exitTimer.current); }, []);

  const open = useCallback(() => {
    clearTimeout(exitTimer.current);
    setIsOpen(true);
    setVisible(true);
    // Double-RAF for reliable entrance animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimating('enter'));
    });
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setAnimating('exit');
    exitTimer.current = setTimeout(() => {
      setVisible(false);
      setAnimating(null);
    }, EXIT_DURATION);
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) close();
    else open();
  }, [isOpen, close, open]);

  return { visible, animating, isOpen, open, close, toggle };
}
