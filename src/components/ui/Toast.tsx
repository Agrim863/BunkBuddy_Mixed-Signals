import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  closing?: boolean;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id' | 'closing'>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<
  ToastTone,
  { border: string; icon: ReactNode; titleColor: string }
> = {
  success: {
    border: 'border-[var(--status-success)]/40 bg-[var(--bg-surface)]',
    icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--status-success)]" />,
    titleColor: 'text-[var(--status-success)]',
  },
  info: {
    border: 'border-[var(--primary)]/40 bg-[var(--bg-surface)]',
    icon: <Info className="h-4 w-4 shrink-0 text-[var(--primary)]" />,
    titleColor: 'text-[var(--primary)]',
  },
  warning: {
    border: 'border-[var(--status-warning)]/40 bg-[var(--bg-surface)]',
    icon: <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--status-warning)]" />,
    titleColor: 'text-[var(--status-warning)]',
  },
  error: {
    border: 'border-[var(--status-danger)]/40 bg-[var(--bg-surface)]',
    icon: <AlertCircle className="h-4 w-4 shrink-0 text-[var(--status-danger)]" />,
    titleColor: 'text-[var(--status-danger)]',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const removeNow = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismissToast = useCallback(
    (id: string) => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, closing: true } : t)),
      );
      window.setTimeout(() => removeNow(id), 160);
    },
    [removeNow],
  );

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id' | 'closing'>) => {
      const id = `toast-${crypto.randomUUID().slice(0, 8)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      const timer = window.setTimeout(() => dismissToast(id), 3400);
      timersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  useEffect(() => {
    const map = timersRef.current;
    return () => {
      for (const timer of map.values()) {
        window.clearTimeout(timer);
      }
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed right-4 bottom-20 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 lg:bottom-5"
      >
        {toasts.map((toast) => {
          const style = TONE_STYLES[toast.tone];
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-2.5 rounded-[14px] border p-3.5 shadow-xl ${style.border} ${
                toast.closing ? 'bw-animate-toast-out' : 'bw-animate-toast-in'
              }`}
            >
              <div className="mt-0.5">{style.icon}</div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold ${style.titleColor}`}>
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
                className="rounded-[8px] p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside a ToastProvider');
  }
  return ctx;
}
