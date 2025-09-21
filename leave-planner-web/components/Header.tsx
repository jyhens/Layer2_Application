import React from "react";
import type { User } from "../types";
import { Role, RoleLabel } from "../types";

type HeaderProps = {
  users: User[];
  currentUser?: User | null;
  onUserChange: (id: string | null) => void;
  onOpenNotifications: () => void;
  onOpenLog: () => void;
  unreadCount?: number;
};

const roleStyles: Record<Role, string> = {
  Employee: "bg-blue-100 text-blue-800",
  Approver: "bg-amber-100 text-amber-800",
  Admin: "bg-rose-100 text-rose-800",
};

const Header: React.FC<HeaderProps> = ({
  users,
  currentUser,
  onUserChange,
  onOpenNotifications,
  onOpenLog,
  unreadCount = 0,
}) => {
  const role: Role = currentUser?.role ?? Role.Employee;

  return (
    <header className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3">
      <div className="text-xl font-semibold">Urlaubsplaner</div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <label
            htmlFor="currentUser"
            className="absolute -top-5 left-0 text-xs text-gray-500"
          >
            Aktueller Nutzer
          </label>
          <select
            id="currentUser"
            className="h-10 min-w-[220px] rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={currentUser?.id ?? ""}
            onChange={(e) => onUserChange(e.target.value || null)}
          >
            <option value="" disabled>
              -- Nutzer wählen --
            </option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
                {user.jobTitle ? ` (${user.jobTitle})` : ""}
              </option>
            ))}
          </select>
        </div>

        {currentUser && (
          <span
            className={`h-10 inline-flex items-center px-3 rounded-md text-sm font-medium ${roleStyles[role]}`}
            title={RoleLabel[role]}
          >
            {RoleLabel[role]}
          </span>
        )}

        <button
          onClick={onOpenNotifications}
          className="relative h-10 inline-flex items-center gap-2 px-3 rounded-md text-sm border bg-white hover:bg-slate-50"
          title="Benachrichtigungen anzeigen"
          aria-label="Benachrichtigungen"
        >
          <span aria-hidden>🔔</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] leading-[18px] text-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenLog}
          className="h-10 inline-flex items-center gap-2 px-3 rounded-md text-sm border bg-white hover:bg-slate-50"
          title="System-Log anzeigen"
        >
          <span aria-hidden>🧾</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
