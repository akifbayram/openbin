import * as React from 'react';
import { cn, haptic } from '@/lib/utils';
import { X } from 'lucide-react';
import { useSheetDismiss, getSheetPanelStyle, getSheetBackdropStyle } from '@/lib/useSheetDismiss';

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId?: string;
}

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  onOpenChange: () => {},
});

const DialogPortalContext = React.createContext<HTMLDivElement | null>(null);

function useDialogPortal() {
  return React.useContext(DialogPortalContext);
}

function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

function DialogTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const { onOpenChange } = React.useContext(DialogContext);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick: () => void }>, {
      onClick: () => onOpenChange(true),
    });
  }
  return <button onClick={() => onOpenChange(true)}>{children}</button>;
}

function DialogContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { open, onOpenChange } = React.useContext(DialogContext);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const [portalNode, setPortalNode] = React.useState<HTMLDivElement | null>(null);

  const [visible, setVisible] = React.useState(false);
  const [animating, setAnimating] = React.useState<'enter' | 'exit' | null>(null);

  const prefersReducedMotion = React.useRef(false);
  React.useEffect(() => {
    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  React.useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating('enter'));
      });
    } else if (visible) {
      setAnimating('exit');
      const duration = prefersReducedMotion.current ? 0 : 200;
      const timer = setTimeout(() => {
        setVisible(false);
        setAnimating(null);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [open, visible]);

  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const {
    panelRef, scrollRef, handleRef,
    translateY, isDragging, isDismissing,
    handlers,
  } = useSheetDismiss({
    onDismiss: () => { haptic(10); onOpenChange(false); },
    enabled: isMobile && open,
  });

  // Merge contentRef (focus trap) and panelRef (gesture) onto the same node
  const mergedRef = React.useCallback((node: HTMLDivElement | null) => {
    (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    (panelRef as unknown as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [panelRef]);

  React.useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [visible]);

  // Escape key to close
  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Focus trap
  React.useEffect(() => {
    if (!open || !contentRef.current) return;
    const el = contentRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus first focusable element
    const focusableSelector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const firstFocusable = el.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    function trapFocus(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusables = el.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!visible) return null;

  const isEntered = animating === 'enter';
  const isExiting = animating === 'exit';

  return (
    <DialogContext.Provider value={{ open, onOpenChange, titleId }}>
      <DialogPortalContext.Provider value={portalNode}>
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div
            className="fixed inset-0 bg-[var(--overlay-backdrop)] backdrop-blur-sm transition-opacity duration-200"
            style={{
              ...getSheetBackdropStyle(translateY, isDragging, isDismissing),
              opacity: isEntered ? 1 : isExiting ? 0 : 0,
            }}
            onClick={() => onOpenChange(false)}
          />
          <div
            ref={mergedRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              'relative z-[60] w-full sm:max-w-md glass-heavy',
              'rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)]',
              'mx-0 sm:mx-4 max-h-[85vh] overflow-hidden flex flex-col',
              'transition-all duration-200',
              className
            )}
            style={{
              ...getSheetPanelStyle(translateY, isDragging, isDismissing),
              opacity: isEntered ? 1 : isExiting ? 0 : 0,
              transform: `${getSheetPanelStyle(translateY, isDragging, isDismissing)?.transform ?? ''} translateY(${isEntered ? '0px' : '8px'})`.trim(),
            }}
            {...handlers}
          >
            <button
              aria-label="Close"
              className="absolute right-5 top-5 z-10 rounded-full p-1.5 bg-[var(--bg-input)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors hidden sm:flex items-center justify-center"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {/* Drag handle — outside scroll container so it's always grabbable */}
            <div
              ref={handleRef}
              className={cn(
                'sm:hidden flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none',
              )}
            >
              <div
                className="w-9 h-[5px] rounded-full bg-[var(--text-tertiary)] transition-opacity"
                style={{ opacity: isDragging ? 0.6 : 0.3 }}
              />
            </div>
            <div
              ref={scrollRef}
              className="overflow-y-auto min-h-0 px-8 pt-2 sm:pt-7 pb-[calc(24px+var(--safe-bottom))] sm:pb-6"
            >
              {children}
            </div>
          </div>
          {/* Portal target for dropdowns — inside z-[60] stacking context but outside overflow-hidden panel */}
          <div ref={setPortalNode} className="absolute z-[70]" />
        </div>
      </DialogPortalContext.Provider>
    </DialogContext.Provider>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left mb-5', className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = React.useContext(DialogContext);
  return <h2 id={titleId} className={cn('text-[20px] font-bold text-[var(--text-primary)]', className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[15px] text-[var(--text-tertiary)] leading-relaxed', className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-7', className)} {...props} />;
}

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, useDialogPortal };
