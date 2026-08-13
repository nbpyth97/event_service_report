import type { Agendamento } from "@/api/client";

const STATUS_ORDER: { status: Agendamento["status"]; label: string; className: string }[] = [
  { status: "pending", label: "Pendentes", className: "status-pending" },
  { status: "confirmed", label: "Confirmados", className: "status-confirmed" },
  { status: "declined", label: "Recusados", className: "status-declined" },
  { status: "cancelled", label: "Cancelados", className: "status-cancelled" },
];

export default function StatusBreakdown({ agendamentos }: { agendamentos: Agendamento[] }) {
  const total = agendamentos.length;
  const counts = STATUS_ORDER.map(({ status, label, className }) => ({
    status,
    label,
    className,
    count: agendamentos.filter((a) => a.status === status).length,
  }));
  const nonEmpty = counts.filter((c) => c.count > 0);

  if (total === 0) {
    return <p className="muted">Sem marcações ainda para mostrar a distribuição.</p>;
  }

  return (
    <div className="status-breakdown">
      <div className="status-breakdown-bar" role="img" aria-label={nonEmpty.map((c) => `${c.count} ${c.label}`).join(", ")}>
        {nonEmpty.map((c) => (
          <span
            key={c.status}
            className={`status-breakdown-segment ${c.className}`}
            style={{ flexGrow: c.count }}
          />
        ))}
      </div>
      <ul className="status-breakdown-legend">
        {counts.map((c) => (
          <li key={c.status} className={`status-breakdown-legend-item ${c.className}`}>
            <span className="status-breakdown-dot" aria-hidden="true" />
            {c.count} {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
