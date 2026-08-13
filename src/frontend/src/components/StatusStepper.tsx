import { CheckCircle2 } from "lucide-react";
import type { Agendamento } from "@/api/client";

const STEPS = ["Solicitado", "Confirmado", "Concluído"];

// A booking's real lifecycle has no "in transit" phase — unlike a delivery
// tracker, "done" here just means the confirmed appointment time has passed.
// Declined/cancelled are terminal branches off this line, not points on it,
// so callers render a separate banner for those instead of this stepper.
export function stepIndexOf(agendamento: Agendamento): number {
  if (agendamento.status === "pending") return 0;
  return new Date(agendamento.end_time) <= new Date() ? 2 : 1;
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
