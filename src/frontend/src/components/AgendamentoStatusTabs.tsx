import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Agendamento } from "@/api/client";

export type StatusFilterKey = "pending" | "confirmed" | "declined";

// No "Todos" tab — an empty selection already means "show everything", so
// toggling all three off (or none on) is how you get back to the full list.
// Only 3 columns also keeps the grid from ever needing to shrink below its
// content width on narrow phones (that's what caused the lateral scroll).
const TABS: { key: StatusFilterKey; label: string; icon: typeof Clock; className: string }[] = [
  { key: "pending", label: "Pendentes", icon: Clock, className: "status-pending" },
  { key: "confirmed", label: "Confirmados", icon: CheckCircle2, className: "status-confirmed" },
  { key: "declined", label: "Recusados", icon: XCircle, className: "status-declined" },
];

// "Recusados" merges declined + cancelled — both mean the slot is freed up
// and no longer actionable, so splitting them into separate tabs would just
// be noise for the person reviewing the list.
export function matchesStatusFilter(agendamento: Agendamento, selected: StatusFilterKey[]): boolean {
  if (selected.length === 0) return true;
  const key: StatusFilterKey = agendamento.status === "cancelled" ? "declined" : (agendamento.status as StatusFilterKey);
  return selected.includes(key);
}

export default function AgendamentoStatusTabs({
  agendamentos,
  selected,
  onToggle,
}: {
  agendamentos: Agendamento[];
  selected: StatusFilterKey[];
  onToggle: (key: StatusFilterKey) => void;
}) {
  return (
    <div className="agendamento-status-tabs" role="group" aria-label="Filtrar por estado (seleção múltipla)">
      {TABS.map(({ key, label, icon: Icon, className }) => {
        const count = agendamentos.filter((a) => matchesStatusFilter(a, [key])).length;
        const isSelected = selected.includes(key);
        // Pending gets an alert tint even when not selected, so a provider
        // scanning the grid notices it needs attention without toggling it.
        const needsAttention = key === "pending" && count > 0 && !isSelected;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isSelected}
            className={`agendamento-status-tab ${className} ${isSelected ? "active" : ""} ${needsAttention ? "agendamento-status-tab-alert" : ""}`}
            onClick={() => onToggle(key)}
          >
            <span className="agendamento-status-tab-top">
              <Icon size={13} aria-hidden="true" />
              {label}
            </span>
            <span className="agendamento-status-tab-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
