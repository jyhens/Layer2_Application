// components/LogDrawer.tsx
import React from "react";
import { getLogs, subscribeLog, type LogEntry } from "../log";

interface LogDrawerProps {
  open: boolean;
  onClose: () => void;
}

const badge: Record<LogEntry["level"], string> = {
  info: "bg-blue-100 text-blue-800",
  warn: "bg-amber-100 text-amber-800",
  error: "bg-red-100 text-red-800",
};

const LogDrawer: React.FC<LogDrawerProps> = ({ open, onClose }) => {
  const [logs, setLogs] = React.useState<LogEntry[]>(getLogs());

  React.useEffect(() => {
    const unsub = subscribeLog(setLogs);
    return () => unsub();
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl border-l border-gray-200 flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">System-Log</h3>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200"
          >
            Schließen
          </button>
        </div>

        <div className="p-4 overflow-auto">
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500">Noch keine Einträge.</p>
          ) : (
            <ul className="space-y-2">
              {logs.map((e) => (
                <li key={e.id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge[e.level]}`}>
                      {e.level.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(e.ts).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-800">{e.text}</p>
                  {e.meta && (
                    <pre className="mt-2 text-xs bg-slate-50 p-2 rounded border overflow-auto">
                      {JSON.stringify(e.meta, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogDrawer;
