import React from "react";
import type { ProjectConflict } from "../types";

type Props = {
  hints: ProjectConflict[];
  variant?: "create" | "approve";
};

const ConflictHintsBlock: React.FC<Props> = ({ hints, variant = "create" }) => {
  if (!hints || hints.length === 0) return null;

  const title =
    variant === "create"
      ? "Mögliche Konflikte (genehmigte Abwesenheiten im Team):"
      : "Mögliche Konflikte (Abwesenheiten/Anfragen im Team):";

  const subtitle =
    variant === "create"
      ? "Hinweis: Beim Beantragen werden nur bereits genehmigte Abwesenheiten anderer im selben Projekt berücksichtigt."
      : "Hinweis: Beim Genehmigen werden genehmigte und angefragte Abwesenheiten anderer berücksichtigt.";

  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
      <p className="text-sm font-semibold text-amber-800 mb-2">{title}</p>
      <ul className="space-y-3 text-sm text-amber-800">
        {hints.map((c) => (
          <li key={c.projectId}>
            <div className="font-semibold">{c.projectName}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs">
                {c.employees.length} Teammitglied{c.employees.length !== 1 ? "er" : ""} betroffen
              </span>
            </div>
            <div className="mt-1 text-[13px] leading-snug">
              {c.employees.map(e => e.employeeName).join(", ")}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-amber-700 mt-3">{subtitle}</p>
    </div>
  );
};

export default ConflictHintsBlock;
