import { X } from 'lucide-react';
import * as React from 'react';
import { useFocusTrap } from '@/lib/useFocusTrap';
import { useOverlayAnimation } from '@/lib/useOverlayAnimation';
import { cn } from '@/lib/utils';

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
  return <button type="button" onClick={() => onOpenChange(true)}>{children}</button>;
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

  const { visible, isEntered, isExiting } = useOverlayAnimation({
    open,
    onClose: () => onOpenChange(false),
  });

  useFocusTrap({ active: open, containerRef: contentRef });

  if (!visible) return null;

  return (
    <DialogContext.Provider value={{ open, onOpenChange, titleId }}>
      <DialogPortalContext.Provider value={portalNode}>
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay dismisses dialog on click */}
          <div
            role="presentation"
            className="fixed inset-0 bg-[var(--overlay-backdrop)] backdrop-blur-sm transition-opacity duration-200"
            style={{ opacity: isEntered ? 1 : 0 }}
            onClick={() => onOpenChange(false)}
          />
          <div
            ref={contentRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              'relative z-[60] w-full sm:max-w-md glass-heavy',
              'rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)]',
              'mx-0 sm:mx-4 max-h-[70vh] sm:max-h-[85vh] overflow-hidden flex flex-col',
              'transition-all duration-200',
              className
            )}
            style={{
              opacity: isEntered ? 1 : 0,
              transform: `translateY(${isEntered ? '0px' : isExiting ? '4px' : '8px'}) scale(${isEntered ? 1 : isExiting ? 0.98 : 0.97})`,
            }}
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute right-5 top-5 z-10 rounded-full p-1.5 bg-[var(--bg-input)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="overflow-y-auto min-h-0 px-8 pt-7 pb-[calc(24px+var(--safe-bottom))] sm:pb-6">
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
