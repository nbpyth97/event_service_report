import type { Agendamento } from "@/api/client";
import { useCurrentUser } from "@/auth/user";
import { useUpdateAgendamentoStatus } from "@/hooks/queries";

const STATUS_LABELS: Record<Agendamento["status"], string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  declined: "Recusado",
  cancelled: "Cancelado",
};

export default function AgendamentoList({ agendamentos }: { agendamentos: Agendamento[] }) {
  const { user } = useCurrentUser();
  const updateStatus = useUpdateAgendamentoStatus();
  const isAdmin = user?.role === "admin";

  if (agendamentos.length === 0) return <p>Nenhum agendamento.</p>;

  return (
    <ul className="agendamento-list">
      {agendamentos.map((agendamento) => (
        <li key={agendamento.id} className="agendamento-list-item">
          <span>{new Date(agendamento.start_time).toLocaleString("pt-BR")}</span>
          <span className={`status status-${agendamento.status}`}>{STATUS_LABELS[agendamento.status]}</span>
          {isAdmin && agendamento.status === "pending" && (
            <span className="agendamento-actions">
              <button type="button" onClick={() => updateStatus.mutate({ id: agendamento.id, status: "confirmed" })}>
                Confirmar
              </button>
              <button type="button" onClick={() => updateStatus.mutate({ id: agendamento.id, status: "declined" })}>
                Recusar
              </button>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
