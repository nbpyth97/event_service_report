import { CheckCircle2 } from "lucide-react";
import type { Agendamento } from "@/api/client";

const STEPS = ["Solicitado", "Confirmado"];

// Declined/cancelled are terminal branches off this line, not points on it,
// so callers render a separate banner for those instead of this stepper —
// stepIndexOf only ever sees "pending" or "confirmed" in practice.
export function stepIndexOf(agendamento: Pick<Agendamento, "status">): number {
  return agendamento.status === "pending" ? 0 : 1;
}

export default function StatusStepper({ stepIndex }: { stepIndex: number }) {
  return (
    <ol className="status-stepper" aria-label="Progresso da marcação">
      {STEPS.map((label, i) => {
        const state = i < stepIndex ? "done" : i === stepIndex ? "current" : "upcoming";
        return (
          <li key={label} className={`status-stepper-step status-stepper-${state}`}>
            <span className="status-stepper-dot" aria-hidden="true">
              {state === "done" ? <CheckCircle2 size={14} /> : <span className="status-stepper-dot-inner" />}
            </span>
            <span className="status-stepper-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
