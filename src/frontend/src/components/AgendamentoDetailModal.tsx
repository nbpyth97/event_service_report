import { useEffect, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, MessageCircle, User, X, XCircle } from "lucide-react";
import type { Agendamento } from "@/api/client";
import { useUpdateAgendamentoStatus } from "@/hooks/queries";
import { useToast } from "@/lib/toast";
import { fmtDateTime, fmtPrice } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import StatusStepper, { stepIndexOf } from "@/components/StatusStepper";

export default function AgendamentoDetailModal({
  agendamento,
  isAdmin,
  onClose,
}: {
  agendamento: Agendamento;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const updateStatus = useUpdateAgendamentoStatus();
  const { showSuccess } = useToast();
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const isEndedState = agendamento.status === "declined" || agendamento.status === "cancelled";

  const handleConfirm = () => {
    updateStatus.mutate(
      { id: agendamento.id, status: "confirmed" },
      {
        onSuccess: () => {
          showSuccess(`Marcação de ${agendamento.customer_name} confirmada.`);
          onClose();
        },
      }
    );
  };

  const handleDecline = () => {
    updateStatus.mutate(
      { id: agendamento.id, status: "declined" },
      {
        onSuccess: () => {
          showSuccess(`Marcação de ${agendamento.customer_name} recusada.`);
          onClose();
        },
      }
    );
    setConfirmingDecline(false);
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agendamento-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-sheet-header">
          <h2 id="agendamento-detail-title">{agendamento.service_name}</h2>
          <button type="button" ref={closeBtnRef} className="modal-close" onClick={onClose} aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {isEndedState ? (
          <div className={`status-endstate status-endstate-${agendamento.status}`}>
            <XCircle size={16} aria-hidden="true" />
            {agendamento.status === "declined" ? "Marcação recusada" : "Marcação cancelada"}
          </div>
        ) : (
          <StatusStepper stepIndex={stepIndexOf(agendamento)} />
        )}

        <div className="modal-sheet-body">
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
      </div>
    </div>
  );
}
