import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  kind: "error" | "success";
  message: string;
}

interface ToastContextValue {
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Lets code outside the React tree (the QueryClient's default onError,
// created once in main.tsx before any component mounts) surface a toast
// without needing a hook.
let bridge: ToastContextValue | null = null;

export function notifyError(message: string) {
  bridge?.showError(message);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: Toast["kind"], message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000)
    );
  }, []);

  const showError = useCallback((message: string) => push("error", message), [push]);
  const showSuccess = useCallback((message: string) => push("success", message), [push]);

  useEffect(() => {
    bridge = { showError, showSuccess };
    return () => {
      bridge = null;
    };
  }, [showError, showSuccess]);

  return (
    <ToastContext.Provider value={{ showError, showSuccess }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`toast toast-${t.kind}`}
            onClick={() => dismiss(t.id)}
            aria-label="Dispensar notificação"
          >
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
