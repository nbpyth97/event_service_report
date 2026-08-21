import { useEffect, useRef, useState } from "react";
import { CheckCircle2, MessageCircle, XCircle } from "lucide-react";
import type { Agendamento } from "@/api/client";
import { useUpdateAgendamentoStatus } from "@/hooks/queries";
import { useToast } from "@/lib/toast";
import { fmtPrice, fmtTime } from "@/lib/format";
import { fmtDateHeading } from "@/lib/date";
import { zonedDateStr } from "@/lib/tz";
import { waLink } from "@/lib/whatsapp";
import StatusChip from "@/components/StatusChip";
import AgendamentoDetailModal from "@/components/AgendamentoDetailModal";
import NotifyWhatsappLink from "@/components/NotifyWhatsappLink";

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
    const key = zonedDateStr(a.start_time);
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
  onOpenDetail,
  highlighted,
}: {
  agendamento: Agendamento;
  onOpenDetail: () => void;
  highlighted: boolean;
}) {
  const updateStatus = useUpdateAgendamentoStatus();
  const { showSuccess } = useToast();
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);

  // Deep-linked from a notification/reminder click — scroll it into view,
  // centered so it stays reachable on a small mobile viewport instead of
  // landing just off the top or bottom edge.
  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }, [highlighted]);

  const handleConfirm = () => {
    updateStatus.mutate(
      { id: agendamento.id, status: "confirmed" },
      { onSuccess: () => showSuccess(`Marcação de ${agendamento.customer_known_name} confirmada.`) }
    );
  };

  const handleDecline = () => {
    updateStatus.mutate(
      { id: agendamento.id, status: "declined" },
      { onSuccess: () => showSuccess(`Marcação de ${agendamento.customer_known_name} recusada.`) }
    );
    setConfirmingDecline(false);
  };

  return (
    <li
      ref={rowRef}
      className={`appt-row${agendamento.status === "pending" ? " appt-row-pending" : ""}${highlighted ? " appt-row-highlighted" : ""}`}
    >
      {/* role="button" div, not a real <button> — the WhatsApp icon links
          placed contextually inside it (next to the name, next to the
          status) are interactive elements, and a <button>/<a> can't nest
          inside a <button>. stopPropagation on those links keeps a click on
          them from also opening the detail modal. */}
      <div
        className="appt-row-trigger"
        role="button"
        tabIndex={0}
        onClick={onOpenDetail}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenDetail();
          }
        }}
      >
        <div className="appt-row-time">
          <span className="appt-row-time-value">{fmtTime(agendamento.start_time)}</span>
          <span className="appt-row-time-duration">{agendamento.service_duration_min} min</span>
        </div>
        <div className="appt-row-identity">
          <span className="appt-row-name-line">
            <span className="appt-row-primary appt-row-customer-name">
              {agendamento.customer_known_name}
            </span>
            {agendamento.customer_phone && (
              <a
                href={waLink(agendamento.customer_phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="ticket-whatsapp-link appt-row-icon-link"
                aria-label={`Falar com ${agendamento.customer_known_name} via WhatsApp`}
                title="Falar com o cliente"
                onClick={(e) => e.stopPropagation()}
              >
                <MessageCircle size={13} aria-hidden="true" />
              </a>
            )}
          </span>
          <span className="appt-row-secondary">{agendamento.service_name}</span>
        </div>
        <div className="appt-row-meta">
          <span className="appt-row-price">{fmtPrice(agendamento.service_price)}</span>
          <span className="appt-row-status-line">
            <StatusChip status={agendamento.status} />
            {agendamento.customer_phone &&
              (agendamento.status === "confirmed" || agendamento.status === "declined") && (
                <NotifyWhatsappLink agendamento={agendamento} className="appt-row-icon-link" />
              )}
          </span>
        </div>
      </div>

      {agendamento.status === "pending" && !confirmingDecline && (
        <div className="ticket-actions">
          <button
            type="button"
            className="ticket-decline-btn"
            onClick={() => setConfirmingDecline(true)}
            disabled={updateStatus.isPending}
          >
            <XCircle size={15} aria-hidden="true" />
            Recusar
          </button>
          <button type="button" className="ticket-confirm-btn" onClick={handleConfirm} disabled={updateStatus.isPending}>
            <CheckCircle2 size={15} aria-hidden="true" />
            Confirmar
          </button>
        </div>
      )}

      {confirmingDecline && (
        <div className="ticket-decline-confirm">
          <p>Recusar a marcação de {agendamento.customer_known_name}?</p>
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
  highlightedId,
}: {
  agendamentos: Agendamento[];
  emptyMessage?: string;
  highlightedId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (agendamentos.length === 0) {
    return (
      <div className="empty-state">
        <p>{emptyMessage ?? "Nenhuma marcação ainda."}</p>
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
                onOpenDetail={() => setSelectedId(agendamento.id)}
                highlighted={agendamento.id === highlightedId}
              />
            ))}
          </ul>
        </div>
      ))}
      {selected && (
        <AgendamentoDetailModal agendamento={selected} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}
