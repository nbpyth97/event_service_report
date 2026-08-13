import { useState } from "react";
import { CheckCircle2, MessageCircle, XCircle } from "lucide-react";
import type { Agendamento } from "@/api/client";
import { useCurrentUser } from "@/auth/user";
import { useUpdateAgendamentoStatus } from "@/hooks/queries";
import { useToast } from "@/lib/toast";
import { fmtPrice, fmtTime } from "@/lib/format";
import { fmtDateHeading, toDateStr } from "@/lib/date";
import { waLink } from "@/lib/whatsapp";
import StatusChip from "@/components/StatusChip";
import AgendamentoDetailModal from "@/components/AgendamentoDetailModal";

interface DateGroup {
  dateStr: string;
  date: Date;
  items: Agendamento[];
}

// Time is the primary axis for reviewing a schedule — grouping by date and
// dropping the repeated date string from every card (it now lives once, in
// the group heading) is what makes 4-5 appointments fit on screen instead
// of 2. Status priority (pending-first) is handled one level up, by the
// Agendamentos page's status-tab filter — this list is purely chronological.
function groupByDate(agendamentos: Agendamento[]): DateGroup[] {
  const sorted = [...agendamentos].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const groups = new Map<string, Agendamento[]>();
  for (const a of sorted) {
    const key = toDateStr(new Date(a.start_time));
    const bucket = groups.get(key);
    if (bucket) bucket.push(a);
    else groups.set(key, [a]);
  }
  return [...groups.entries()].map(([dateStr, items]) => ({
    dateStr,
    date: new Date(items[0].start_time),
    items,
  }));
}

function AppointmentRow({
  agendamento,
  isAdmin,
  onOpenDetail,
}: {
  agendamento: Agendamento;
  isAdmin: boolean;
  onOpenDetail: () => void;
}) {
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
    <li className={`appt-row${agendamento.status === "pending" ? " appt-row-pending" : ""}`}>
      <button type="button" className="appt-row-trigger" onClick={onOpenDetail}>
        <div className="appt-row-time">
          <span className="appt-row-time-value">{fmtTime(agendamento.start_time)}</span>
          <span className="appt-row-time-duration">{agendamento.service_duration_min} min</span>
        </div>
        <div className="appt-row-identity">
          {isAdmin ? (
            <>
              <span className="appt-row-primary">{agendamento.customer_name}</span>
              <span className="appt-row-secondary">{agendamento.service_name}</span>
            </>
          ) : (
            <span className="appt-row-primary">{agendamento.service_name}</span>
          )}
        </div>
        <div className="appt-row-meta">
          <span className="appt-row-price">{fmtPrice(agendamento.service_price)}</span>
          <StatusChip status={agendamento.status} />
        </div>
      </button>

      {isAdmin && agendamento.status === "pending" && !confirmingDecline && (
        <div className="ticket-actions">
          <button type="button" className="ticket-confirm-btn" onClick={handleConfirm} disabled={updateStatus.isPending}>
            <CheckCircle2 size={15} aria-hidden="true" />
            Confirmar
          </button>
          <button
            type="button"
            className="ticket-decline-btn"
            onClick={() => setConfirmingDecline(true)}
            disabled={updateStatus.isPending}
          >
            <XCircle size={15} aria-hidden="true" />
            Recusar
          </button>
          {agendamento.customer_phone && (
            <a
              href={waLink(agendamento.customer_phone, `Olá ${agendamento.customer_name}, sobre a sua marcação de ${agendamento.service_name}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="ticket-whatsapp-btn"
              aria-label={`Contactar ${agendamento.customer_name} via WhatsApp`}
              title="Contactar via WhatsApp"
            >
              <MessageCircle size={17} aria-hidden="true" />
            </a>
          )}
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

export default function AgendamentoList({
  agendamentos,
  emptyMessage,
}: {
  agendamentos: Agendamento[];
  emptyMessage?: string;
}) {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (agendamentos.length === 0) {
    return (
      <div className="empty-state">
        <p>{emptyMessage ?? (isAdmin ? "Nenhuma marcação ainda." : "Ainda não tem marcações.")}</p>
        {!isAdmin && <p>Escolha um serviço para marcar o seu horário.</p>}
      </div>
    );
  }

  const groups = groupByDate(agendamentos);
  const selected = agendamentos.find((a) => a.id === selectedId) ?? null;

  return (
    <>
      {groups.map((group) => (
        <div key={group.dateStr} className="agendamento-date-group">
          <div className="agendamento-date-heading">
            <span className="agendamento-date-heading-label">{fmtDateHeading(group.date)}</span>
            <span className="agendamento-date-heading-count">
              {group.items.length} agendamento{group.items.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="agendamento-cards">
            {group.items.map((agendamento) => (
              <AppointmentRow
                key={agendamento.id}
                agendamento={agendamento}
                isAdmin={isAdmin}
                onOpenDetail={() => setSelectedId(agendamento.id)}
              />
            ))}
          </ul>
        </div>
      ))}
      {selected && (
        <AgendamentoDetailModal agendamento={selected} isAdmin={isAdmin} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}
