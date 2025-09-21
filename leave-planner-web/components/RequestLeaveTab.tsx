import React, { useState, useMemo, useEffect } from "react";
import type { User, Leave, ProjectConflict } from "../types";
import { Role, LeaveStatus, LeaveStatusLabel } from "../types";
import { AlertTriangleIcon, CalendarIcon } from "./Icons";

interface RequestLeaveTabProps {
  currentUser: User | null;
  users: User[];
  leaves: Leave[];
  onCreateLeave: (userId: string, date: string) => Promise<Leave | null>;
  onCheckConflicts: (userId: string, date: string) => ProjectConflict[];
}

const statusStyles: Record<LeaveStatus, string> = {
  [LeaveStatus.Requested]: "bg-yellow-100 text-yellow-800",
  [LeaveStatus.Approved]: "bg-green-100 text-green-800",
  [LeaveStatus.Rejected]: "bg-red-100 text-red-800",
};

const RequestLeaveTab: React.FC<RequestLeaveTabProps> = ({
  currentUser,
  users,
  leaves,
  onCreateLeave,
  onCheckConflicts,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(currentUser?.id);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser) setSelectedUserId(currentUser.id);
  }, [currentUser]);

  const canSelectUser =
    currentUser?.role === Role.Approver || currentUser?.role === Role.Admin;

  const { hints, conflicts } = useMemo(() => {
    if (!selectedUserId || !selectedDate) {
      return { hints: [] as string[], conflicts: [] as ProjectConflict[] };
    }

    const hints: string[] = [];
    const dup = leaves.find((l) => l.employeeId === selectedUserId && l.date === selectedDate);
    if (dup)
      hints.push(
        `Konflikt: Für diesen Mitarbeiter existiert bereits ein Antrag (${LeaveStatusLabel[dup.status]}).`
      );

    const conflicts = onCheckConflicts(selectedUserId, selectedDate);
    return { hints, conflicts };
  }, [selectedUserId, selectedDate, leaves, onCheckConflicts]);

  const hasHardConflict = hints.some((h) => h.startsWith("Konflikt"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !selectedDate || hasHardConflict) return;

    setIsSubmitting(true);
    try {
      const created = await onCreateLeave(selectedUserId, selectedDate);
      if (created) setSelectedDate("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const viewingUserId = canSelectUser ? selectedUserId ?? currentUser?.id : currentUser?.id;
  const myLeaves = useMemo(() => {
    if (!viewingUserId) return [];
    return leaves
      .filter((l) => l.employeeId === viewingUserId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [leaves, viewingUserId]);

  const renderBackendConflicts = (conflicts: ProjectConflict[], date: string) => {
    if (!conflicts || conflicts.length === 0) return null;
    return (
      <ul className="space-y-1">
        {conflicts.map((c) => {
          let approved = 0;
          let requested = 0;
          const approvedNames: string[] = [];
          const requestedNames: string[] = [];

          for (const emp of c.employees) {
            const found = leaves.find((l) => l.employeeId === emp.employeeId && l.date === date);
            if (found?.status === LeaveStatus.Approved) {
              approved++;
              approvedNames.push(emp.employeeName);
            } else if (found?.status === LeaveStatus.Requested) {
              requested++;
              requestedNames.push(emp.employeeName);
            }
          }

          const tooltip: string[] = [];
          if (approved > 0) tooltip.push(`Genehmigt: ${approvedNames.join(", ")}`);
          if (requested > 0) tooltip.push(`Angefragt: ${requestedNames.join(", ")}`);

          return (
            <li key={c.projectId} title={tooltip.join(" | ")}>
              <div className="flex items-center text-xs">
                <span className="font-semibold truncate pr-2">{c.projectName}:</span>
                <div className="flex items-center flex-wrap gap-1">
                  {approved > 0 && (
                    <span className="px-1.5 py-0.5 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                      {approved} genehmigt
                    </span>
                  )}
                  {requested > 0 && (
                    <span className="px-1.5 py-0.5 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full">
                      {requested} angefragt
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  const approverName = (id?: string | null) =>
    id ? users.find((u) => u.id === id)?.name ?? "—" : "—";

  const prettyDateTime = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="bg-surface p-6 rounded-xl shadow-sm border border-border">
      <h2 className="text-xl font-bold text-text-primary mb-4">Urlaub beantragen</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="employee-select" className="block text-sm font-medium text-slate-700">
              Mitarbeiter
            </label>
            <select
              id="employee-select"
              value={selectedUserId ?? ""}
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={!canSelectUser}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              {canSelectUser
                ? users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))
                : currentUser && <option value={currentUser.id}>{currentUser.name}</option>}
            </select>
          </div>

          <div>
            <label htmlFor="leave-date" className="block text-sm font-medium text-slate-700">
              Datum
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <CalendarIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="date"
                id="leave-date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 pl-10 bg-white"
              />
            </div>
          </div>
        </div>

        {(hints.length > 0 || conflicts.length > 0) && (
          <div className="bg-amber-50 border-l-4 border-warning p-4 rounded-r-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangleIcon className="h-5 w-5 text-warning" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-amber-800 mb-2">Mögliche Konflikte & Hinweise</p>
                <ul className="list-disc list-inside text-sm text-amber-700 space-y-2">
                  {hints.map((h, i) => (
                    <li key={`hint-${i}`}>{h}</li>
                  ))}
                </ul>
                {renderBackendConflicts(conflicts, selectedDate || "")}
              </div>
            </div>
          </div>
        )}

        <p className="text-sm text-slate-500 italic">
          Hinweis: Beim Beantragen werden nur bereits <b>genehmigte</b> Abwesenheiten anderer im selben Projekt als
          Konflikt berücksichtigt.
        </p>

        <div>
          <button
            type="submit"
            disabled={!selectedUserId || !selectedDate || hasHardConflict || isSubmitting}
            className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent bg-primary py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Wird beantragt..." : "Urlaub beantragen"}
          </button>
        </div>
      </form>

      <div className="mt-10">
        <h3 className="text-lg font-semibold text-text-primary mb-3">
          {canSelectUser ? "Anträge des ausgewählten Mitarbeiters" : "Meine Anträge"}
        </h3>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kommentar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entschieden von / am</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {myLeaves.length > 0 ? (
                myLeaves.map((l) => (
                  <tr key={l.id}>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{l.date}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[l.status]}`}>
                        {LeaveStatusLabel[l.status]}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700">
                      {l.decisionComment?.trim() || "—"}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-500">
                      {l.status === LeaveStatus.Requested
                        ? "—"
                        : `${approverName(l.decisionByEmployeeId)} • ${prettyDateTime(l.decisionAt)}`}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                    Keine Anträge gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default RequestLeaveTab;
