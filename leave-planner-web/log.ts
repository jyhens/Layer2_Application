// log.ts
export type LogEntry = {
  id: number;
  ts: string;          // ISO timestamp
  level: "info" | "warn" | "error";
  text: string;
  meta?: Record<string, any>;
};

let listeners: Array<(entries: LogEntry[]) => void> = [];
let entries: LogEntry[] = [];

export function addLog(text: string, level: LogEntry["level"] = "info", meta?: Record<string, any>) {
  const e: LogEntry = { id: Date.now() + Math.random(), ts: new Date().toISOString(), level, text, meta };
  entries = [e, ...entries].slice(0, 500);
  listeners.forEach((l) => l(entries));
}

export function getLogs(): LogEntry[] {
  return entries;
}

export function subscribeLog(fn: (entries: LogEntry[]) => void) {
  listeners.push(fn);
  fn(entries); // initial push
  return () => {
    listeners = listeners.filter((x) => x !== fn);
  };
}
