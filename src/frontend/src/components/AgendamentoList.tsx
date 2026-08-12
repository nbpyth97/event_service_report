import { useState } from "react";
import { CalendarDays, User } from "lucide-react";
import type { Agendamento } from "@/api/client";
import { useCurrentUser } from "@/auth/user";
import { useUpdateAgendamentoStatus } from "@/hooks/queries";
import { useToast } from "@/lib/toast";
import StatusChip from "@/components/StatusChip";

function fmtPrice(price: string): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Number(price));
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Pending requests are the actionable queue — surfaced first regardless of
// date — everything else follows in chronological order.
function sortForReview(agendamentos: Agendamento[]): Agendamento[] {
  return [...agendamentos].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (b.status === "pending" && a.status !== "pending") return 1;
    return a.start_time.localeCompare(b.start_time);
  });
}

function TicketCard({ agendamento, isAdmin }: { agendamento: Agendamento; isAdmin: boolean }) {
  const updateStatus = useUpdateAgendamentoStatus();
  const { showSuccess } = useToast();
  const [confirmingDecline, setConfirmingDecline] = useState(false);

  const handleConfirm = () => {
    updateStatus.mutate(
      { id: agendamento.id, status: "confirmed" },
      { onSuccess: () => showSuccess(`Marcação de ${agendamento.customer_name} confirmada.`) }
    );
  };

  const handleDecline = () => {
    updateStatus.mutate(
      { id: agendamento.id, status: "declined" },
      { onSuccess: () => showSuccess(`Marcação de ${agendamento.customer_name} recusada.`) }
    );
    setConfirmingDecline(false);
  };

  return (
    <li className="ticket-card">
      <div className="ticket-top">
        <span className="ticket-service">{agendamento.service_name}</span>
        <StatusChip status={agendamento.status} />
      </div>
      <div className="ticket-divider" aria-hidden="true" />
      <div className="ticket-body">
        {isAdmin && (
          <div className="ticket-row ticket-customer">
            <User size={14} aria-hidden="true" />
            {agendamento.customer_name}
          </div>
        )}
        <div className="ticket-row">
          <CalendarDays size={14} aria-hidden="true" />
          {fmtDateTime(agendamento.start_time)}
        </div>
        <div className="ticket-meta">
          {agendamento.service_duration_min} min · {fmtPrice(agendamento.service_price)}
        </div>
      </div>

      {isAdmin && agendamento.status === "pending" && !confirmingDecline && (
        <div className="ticket-actions">
          <button type="button" onClick={handleConfirm} disabled={updateStatus.isPending}>
            Confirmar
          </button>
          <button
            type="button"
            className="ticket-decline-btn"
            onClick={() => setConfirmingDecline(true)}
            disabled={updateStatus.isPending}
          >
            Recusar
          </button>
        </div>
      )}

      {isAdmin && confirmingDecline && (
        <div className="ticket-decline-confirm">
          <p>Recusar a marcação de {agendamento.customer_name}?</p>
          <button type="button" className="ticket-decline-cancel" onClick={() => setConfirmingDecline(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className="ticket-decline-submit"
            onClick={handleDecline}
            disabled={updateStatus.isPending}
          >
            {updateStatus.isPending ? "A recusar…" : "Sim, recusar"}
          </button>
        </div>
      )}
    </li>
  );
}

export default function AgendamentoList({ agendamentos }: { agendamentos: Agendamento[] }) {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin";

  if (agendamentos.length === 0) {
    return (
      <div className="empty-state">
        <p>{isAdmin ? "Nenhuma marcação ainda." : "Ainda não tem marcações."}</p>
        {!isAdmin && <p>Escolha um serviço para marcar o seu horário.</p>}
      </div>
    );
  }

  const ordered = isAdmin ? sortForReview(agendamentos) : agendamentos;
  const pendingCount = ordered.filter((a) => a.status === "pending").length;

  return (
    <>
      {isAdmin && pendingCount > 0 && (
        <p className="agendamento-section-label">{pendingCount} aguardando aprovação</p>
      )}
      <ul className="agendamento-cards">
        {ordered.map((agendamento) => (
          <TicketCard key={agendamento.id} agendamento={agendamento} isAdmin={isAdmin} />
        ))}
      </ul>
    </>
  );
}
