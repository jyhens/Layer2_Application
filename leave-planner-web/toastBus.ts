// toastBus.ts
export type ToastPayload = {
  text: string;
  type?: "info" | "success" | "error" | "warning";
  durationMs?: number; // default 60s
};

type Listener = (msg: ToastPayload) => void;

const listeners = new Set<Listener>();

export function subscribeToToasts(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function pushToast(msg: ToastPayload) {
  for (const fn of listeners) fn(msg);
}
