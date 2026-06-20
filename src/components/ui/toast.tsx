import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Toast = { id: number; message: string };

type ToastContextValue = { show: (message: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const NOOP: ToastContextValue = { show: () => {} };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string) => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((current) => [...current, { id, message }]);
    setTimeout(
      () => setToasts((current) => current.filter((t) => t.id !== id)),
      2500,
    );
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? NOOP;
}
