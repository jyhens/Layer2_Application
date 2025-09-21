// components/NotificationsDrawer.tsx
import React from "react";
import {
  listNotifications,
  markNotificationsRead,
  NotificationItem,
  NotificationKind,
} from "../api";

type Props = {
  open: boolean;
  onClose: () => void;
  currentUserId: string | null;
  onChanged?: () => void;
};

const kindLabel = (k: NotificationKind) =>
  k === NotificationKind.Submitted
    ? "Antrag eingereicht"
    : k === NotificationKind.Approved
    ? "Antrag genehmigt"
    : "Antrag abgelehnt";

const badgeClass = (k: NotificationKind) =>
  k === NotificationKind.Approved
    ? "bg-green-100 text-green-800"
    : k === NotificationKind.Rejected
    ? "bg-red-100 text-red-800"
    : "bg-amber-100 text-amber-800";

export default function NotificationsDrawer({
  open,
  onClose,
  currentUserId,
  onChanged,
}: Props) {
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [onlyUnread, setOnlyUnread] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState(false);
  const [selection, setSelection] = React.useState<Record<string, boolean>>({});

  const load = React.useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const data = await listNotifications({
        userId: currentUserId,
        onlyUnread,
      });
      setItems(data);
      setSelection({});
    } finally {
      setLoading(false);
    }
  }, [currentUserId, onlyUnread]);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  const toggleSel = (id: string) =>
    setSelection((s) => ({ ...s, [id]: !s[id] }));

  const markSelectedAsRead = async () => {
    const ids = Object.entries(selection)
      .filter(([, v]) => v)
      .map(([id]) => id);
    if (ids.length === 0) return;
    await markNotificationsRead(ids);
    await load();
    onChanged?.();
  };

  const markAllAsRead = async () => {
    const ids = items.filter((n) => !n.isRead).map((n) => n.id);
    if (ids.length === 0) return;
    await markNotificationsRead(ids);
    await load();
    onChanged?.();
  };

  const prettyDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <aside className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl border-l border-gray-200 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-base font-semibold">Benachrichtigungen</h3>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="px-3 py-1.5 border rounded-md text-sm bg-white hover:bg-slate-50 disabled:opacity-50"
                disabled={loading || !currentUserId}
              >
                Neu laden
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1.5 border rounded-md text-sm bg-white hover:bg-slate-50"
              >
                Schließen
              </button>
            </div>

            <label className="text-sm flex items-center gap-1">
              <input
                type="checkbox"
                checked={onlyUnread}
                onChange={(e) => setOnlyUnread(e.target.checked)}
              />
              nur ungelesene
            </label>
          </div>
        </div>

        <div className="px-4 pt-3 pb-2 border-b flex items-center justify-between">
          <div className="text-sm text-slate-600">
            {items.length} Einträge{onlyUnread ? " (ungelesen)" : ""}
          </div>
          <button
            onClick={markAllAsRead}
            className="px-3 py-1.5 rounded-md text-sm bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
            disabled={items.every((n) => n.isRead)}
          >
            Alle sichtbaren als gelesen
          </button>
        </div>

        <div className="p-4 overflow-y-auto h-[calc(100%-140px)]">
          {loading ? (
            <div className="text-sm text-slate-500">Lade…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-500">Keine Benachrichtigungen.</div>
          ) : (
            <ul className="space-y-2">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`border rounded-lg p-3 flex items-start gap-3 ${
                    n.isRead ? "bg-white" : "bg-amber-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={!!selection[n.id]}
                    onChange={() => toggleSel(n.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass(
                          n.kind
                        )}`}
                      >
                        {kindLabel(n.kind)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {prettyDateTime(n.createdAt)}
                      </span>
                      {!n.isRead && (
                        <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                          neu
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-slate-800">
                      <div>
                        Datum: <span className="font-medium">{n.date}</span>
                      </div>
                      {n.actorName && (
                        <div>
                          von: <span className="font-medium">{n.actorName}</span>
                        </div>
                      )}
                      {n.comment && (
                        <div className="italic text-slate-600">“{n.comment}”</div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          <button
            onClick={markSelectedAsRead}
            className="px-3 py-1.5 rounded-md text-sm bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
            disabled={Object.values(selection).every((v) => !v)}
          >
            Markierte als gelesen
          </button>
        </div>
      </aside>
    </div>
  );
}
