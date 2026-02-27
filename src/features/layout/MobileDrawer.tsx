import { useRef } from 'react';
import { useOverlayAnimation } from '@/lib/useOverlayAnimation';
import { useFocusTrap } from '@/lib/useFocusTrap';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileDrawer({ open, onClose, children }: MobileDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { visible, isEntered } = useOverlayAnimation({ open, onClose });
  useFocusTrap({ active: open, containerRef: panelRef });

  if (!visible) return null;

  const duration = '200ms';

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[var(--overlay-backdrop)] backdrop-blur-sm"
        style={{
          opacity: isEntered ? 1 : 0,
          transition: `opacity ${duration} ease`,
        }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="fixed top-0 left-0 h-dvh w-[260px] bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] flex flex-col overflow-y-auto pt-[var(--safe-top)]"
        style={{
          transform: isEntered ? 'translateX(0)' : 'translateX(-100%)',
          transition: `transform ${duration} cubic-bezier(0.2, 0.9, 0.3, 1)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
