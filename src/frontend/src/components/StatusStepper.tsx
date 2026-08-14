import { CheckCircle2 } from "lucide-react";
import type { Agendamento } from "@/api/client";
import { fmtTime } from "@/lib/format";

const STEPS = ["Solicitado", "Confirmado"];
const STEP_STATUSES: Agendamento["status"][] = ["pending", "confirmed"];

// Declined/cancelled are terminal branches off this line, not points on it,
// so callers render a separate banner for those instead of this stepper —
// stepIndexOf only ever sees "pending" or "confirmed" in practice.
export function stepIndexOf(agendamento: Pick<Agendamento, "status">): number {
  return agendamento.status === "pending" ? 0 : 1;
}

export default function StatusStepper({
  stepIndex,
  timestamps,
}: {
  stepIndex: number;
  timestamps?: Partial<Record<Agendamento["status"], string>>;
}) {
  return (
    <ol className="status-stepper" aria-label="Progresso da marcação">
      {STEPS.map((label, i) => {
        const state = i < stepIndex ? "done" : i === stepIndex ? "current" : "upcoming";
        const timestamp = timestamps?.[STEP_STATUSES[i]];
        return (
          <li key={label} className={`status-stepper-step status-stepper-${state}`}>
            <span className="status-stepper-dot" aria-hidden="true">
              {state === "done" ? <CheckCircle2 size={14} /> : <span className="status-stepper-dot-inner" />}
            </span>
            <span className="status-stepper-label">{label}</span>
            {timestamp && <span className="status-stepper-time">{fmtTime(timestamp)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
