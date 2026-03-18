import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type ToastVariant = 'default' | 'success' | 'error' | 'warning';

const variantStyles: Record<ToastVariant, string> = {
  default: '',
  success: 'bg-[var(--color-success-soft)] ring-1 ring-[var(--color-success-ring)]',
  error: 'bg-[var(--destructive)]/10 ring-1 ring-[var(--destructive)]/20',
  warning: 'bg-[var(--color-warning-soft)] ring-1 ring-[var(--color-warning-ring)]',
};

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />,
  success: <CheckCircle className="h-4 w-4 text-[var(--color-success)] shrink-0" />,
  error: <XCircle className="h-4 w-4 text-[var(--destructive)] shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-[var(--color-warning)] shrink-0" />,
};

interface Toast {
  id: number;
  message: string;
  variant?: ToastVariant;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <output aria-live="assertive" aria-atomic="true" className="fixed bottom-[calc(16px+var(--safe-bottom))] lg:bottom-8 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none print-hide">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </output>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.duration ?? 4000);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [toast, onDismiss]);

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-3.5 rounded-[var(--radius-xl)] px-5 py-3.5 transition-all duration-300 min-w-[280px] max-w-[90vw]',
        'glass-heavy text-[var(--text-primary)]',
        variantStyles[toast.variant ?? 'default'],
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
    >
      {variantIcons[toast.variant ?? 'default']}
      <span className="text-[15px] flex-1">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={toast.action.onClick}
          className="text-[15px] font-semibold text-[var(--accent)] hover:opacity-80 shrink-0"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          setTimeout(() => onDismiss(toast.id), 300);
        }}
        aria-label="Dismiss"
        className="p-2.5 -mr-1.5 rounded-[var(--radius-lg)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
