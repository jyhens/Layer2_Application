import React from "react";
import type { ProjectConflict } from "../types";

type Props = {
  conflicts: ProjectConflict[];
};

/**
 * Pure UI component that renders backend conflicts:
 * - project name
 * - badge with number of teammates
 * - comma-separated list of names
 */
export default function RenderConflictDetails({ conflicts }: Props) {
  if (!conflicts || conflicts.length === 0) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <ul className="space-y-3 text-sm text-amber-800">
      {conflicts.map((c) => (
        <li key={c.projectId}>
          <div className="font-semibold">{c.projectName}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs">
              {c.employees.length} Teammitglied{c.employees.length !== 1 ? "er" : ""} betroffen
            </span>
          </div>
          <div className="mt-1 text-[13px] leading-snug">
            {c.employees.map((e) => e.employeeName).join(", ")}
          </div>
        </li>
      ))}
    </ul>
  );
}
