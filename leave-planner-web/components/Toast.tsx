import React from "react";
import { CheckCircleIcon, XCircleIcon, AlertTriangleIcon } from "./Icons";

export interface SingleToastProps {
  message: string;
  type: "success" | "error" | "warning";
  onClose: () => void;
}

const styleByType = {
  success: {
    bg: "bg-green-50",
    text: "text-green-800",
    iconColor: "text-green-700",
    Icon: CheckCircleIcon,
  },
  error: {
    bg: "bg-red-50",
    text: "text-red-800",
    iconColor: "text-red-700",
    Icon: XCircleIcon,
  },
  warning: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    iconColor: "text-amber-700",
    Icon: AlertTriangleIcon,
  },
};

const Toast: React.FC<SingleToastProps> = ({ message, type, onClose }) => {
  const { bg, text, iconColor, Icon } = styleByType[type];

  React.useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`max-w-sm w-full ${bg} shadow-lg rounded-lg ring-1 ring-black/5 overflow-hidden`}>
      <div className="p-4 flex items-start gap-3">
        <Icon className={`h-6 w-6 ${iconColor}`} aria-hidden="true" />
        <p className={`text-sm font-medium ${text}`}>{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto inline-flex rounded-md text-slate-400 hover:text-slate-600 focus:outline-none"
          aria-label="Schließen"
          title="Schließen"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Toast;

type PubToast = { text: string; type: "success" | "error" | "warning"; durationMs?: number };
type Listener = (t: PubToast) => void;

let listeners: Listener[] = [];

export function subscribeToToasts(fn: Listener) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((x) => x !== fn);
  };
}

export function pushToast(t: PubToast) {
  listeners.forEach((fn) => fn(t));
}

export const ToastProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [items, setItems] = React.useState<Array<{ id: number } & PubToast>>([]);

  const show = React.useCallback((msg: PubToast) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, ...msg }]);
    const ttl = typeof msg.durationMs === "number" ? msg.durationMs : 3000;
    setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, ttl);
  }, []);

  React.useEffect(() => {
    const unsub = subscribeToToasts((msg) => show(msg));
    return () => {
      unsub();
    };
  }, [show]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed z-50 top-4 right-4 space-y-2 w-[min(92vw,360px)]">
        {items.map((t) => (
          <Toast
            key={t.id}
            message={t.text}
            type={t.type}
            onClose={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

type ToastCtx = { show: (t: PubToast) => void };
const ToastContext = React.createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast muss innerhalb von <ToastProvider> verwendet werden");
  return ctx;
}
