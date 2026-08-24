import { CheckCircle2, XCircle } from "lucide-react";
import type { Agendamento, AgendamentoStatusHistoryEntry } from "@/api/client";
import { fmtShortDateTime } from "@/lib/format";

const LABELS: Record<Agendamento["status"], string> = {
  pending: "Solicitado",
  confirmed: "Confirmado",
  declined: "Recusado",
  cancelled: "Cancelado",
};

// Same dot/line/label/time visual as StatusStepper, generalized to the full
// history chain instead of a fixed two-step Solicitado/Confirmado line —
// used for declined/cancelled bookings so the terminal state reads as one
// more step on the same line rather than a separate banner + bullet list.
export default function StatusHistoryStepper({ history }: { history: AgendamentoStatusHistoryEntry[] }) {
  const lastIndex = history.length - 1;

  return (
    <ol className="status-stepper" aria-label="Histórico da marcação">
      {history.map((h, i) => {
        const isTerminal = i === lastIndex && (h.to_status === "declined" || h.to_status === "cancelled");
        return (
          <li
            key={i}
            className={`status-stepper-step ${isTerminal ? "status-stepper-terminal" : "status-stepper-done"}`}
          >
            <span className="status-stepper-dot" aria-hidden="true">
              {isTerminal ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
            </span>
            <span className="status-stepper-label">{LABELS[h.to_status]}</span>
            <span className="status-stepper-time">{fmtShortDateTime(h.changed_at)}</span>
          </li>
        );
      })}
    </ol>
  );
}
