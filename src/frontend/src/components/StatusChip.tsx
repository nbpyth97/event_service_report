import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Agendamento } from "@/api/client";

const STATUS_CONFIG: Record<Agendamento["status"], { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: "Pendente", icon: Clock, className: "status-pending" },
  confirmed: { label: "Confirmado", icon: CheckCircle2, className: "status-confirmed" },
  declined: { label: "Recusado", icon: XCircle, className: "status-declined" },
  cancelled: { label: "Cancelado", icon: XCircle, className: "status-cancelled" },
};

// Status is never color-only — every chip pairs an icon with its label so it
// still reads correctly for colorblind users or on a washed-out phone screen.
export default function StatusChip({ status }: { status: Agendamento["status"] }) {
  const { label, icon: Icon, className } = STATUS_CONFIG[status];
  return (
    <span className={`status-chip ${className}`}>
      <Icon size={13} aria-hidden="true" />
      {label}
    </span>
  );
}
