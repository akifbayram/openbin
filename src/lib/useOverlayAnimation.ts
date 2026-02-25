import { useState, useEffect, useRef } from 'react';

interface UseOverlayAnimationOptions {
  open: boolean;
  onClose?: () => void;
  duration?: number;
  lockScroll?: boolean;
}

export function useOverlayAnimation({
  open,
  onClose,
  duration = 200,
  lockScroll = true,
}: UseOverlayAnimationOptions) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState<'enter' | 'exit' | null>(null);

  const prefersReducedMotion = useRef(false);
  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Mount/unmount with enter/exit animation
  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating('enter'));
      });
    } else if (visible) {
      setAnimating('exit');
      const d = prefersReducedMotion.current ? 0 : duration;
      const timer = setTimeout(() => {
        setVisible(false);
        setAnimating(null);
      }, d);
      return () => clearTimeout(timer);
    }
  }, [open, visible, duration]);

  // Scroll lock
  useEffect(() => {
    if (!lockScroll) return;
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [visible, lockScroll]);

  // Escape key
  useEffect(() => {
    if (!open || !onClose) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose!();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return {
    visible,
    isEntered: animating === 'enter',
    isExiting: animating === 'exit',
  };
}
