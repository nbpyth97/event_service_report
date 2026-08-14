import { useEffect, useRef, useState } from "react";
import { BellRing, CalendarDays, CheckCircle2, Clock, Euro, MessageCircle, User, X, XCircle } from "lucide-react";
import type { Agendamento } from "@/api/client";
import { useUpdateAgendamentoStatus } from "@/hooks/queries";
import { useToast } from "@/lib/toast";
import { fmtDateTime, fmtPriceValue, fmtTime } from "@/lib/format";
import { statusUpdateMessage, waLink } from "@/lib/whatsapp";
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
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Bell sits inline with whatever's showing the status — the
            end-state banner or the stepper — since "send a status update"
            is contextually tied to the status itself, not to the client's
            identity below. */}
        {isEndedState ? (
          <div className={`status-endstate status-endstate-${agendamento.status}`}>
            <XCircle size={16} aria-hidden="true" />
            {agendamento.status === "declined" ? "Marcação recusada" : "Marcação cancelada"}
            {isAdmin && agendamento.customer_phone && agendamento.status === "declined" && (
              <a
                href={waLink(agendamento.customer_phone, statusUpdateMessage(agendamento))}
                target="_blank"
                rel="noopener noreferrer"
                className="ticket-whatsapp-link ticket-whatsapp-link-alert status-endstate-notify"
                aria-label={`Atualizar ${agendamento.customer_name} sobre o estado da marcação via WhatsApp`}
                title="Enviar atualização de estado"
              >
                <BellRing size={14} aria-hidden="true" />
              </a>
            )}
          </div>
        ) : (
          <div className="status-stepper-row">
            <StatusStepper stepIndex={stepIndexOf(agendamento)} />
            {isAdmin && agendamento.customer_phone && agendamento.status === "confirmed" && (
              <a
                href={waLink(agendamento.customer_phone, statusUpdateMessage(agendamento))}
                target="_blank"
                rel="noopener noreferrer"
                className="ticket-whatsapp-link ticket-whatsapp-link-alert"
                aria-label={`Atualizar ${agendamento.customer_name} sobre o estado da marcação via WhatsApp`}
                title="Enviar atualização de estado"
              >
                <BellRing size={14} aria-hidden="true" />
              </a>
            )}
          </div>
        )}

        <div className="modal-sheet-body">
          <div className="modal-meta-card">
            {isAdmin && (
              <div className="ticket-row">
                <User size={14} aria-hidden="true" />
                <span className="ticket-customer-name">{agendamento.customer_name}</span>
                {agendamento.customer_phone && (
                  <a
                    href={waLink(agendamento.customer_phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ticket-whatsapp-link"
                    aria-label={`Falar com ${agendamento.customer_name} via WhatsApp`}
                    title="Falar com o cliente"
                  >
                    <MessageCircle size={13} aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
            <div className="ticket-row">
              <CalendarDays size={14} aria-hidden="true" />
              <span>
                {fmtDateTime(agendamento.start_time)} – {fmtTime(agendamento.end_time)}
              </span>
            </div>
            <div className="ticket-row">
              <Clock size={14} aria-hidden="true" />
              <span>{agendamento.service_duration_min} min</span>
            </div>
            <div className="ticket-row">
              <Euro size={14} aria-hidden="true" />
              <span className="ticket-meta-price">{fmtPriceValue(agendamento.service_price)}</span>
            </div>
          </div>
        </div>

        {isAdmin && agendamento.status === "pending" && !confirmingDecline && (
          <div className="ticket-actions">
            <button
              type="button"
              className="ticket-decline-btn"
              onClick={() => setConfirmingDecline(true)}
              disabled={updateStatus.isPending}
            >
              <XCircle size={16} aria-hidden="true" />
              Recusar
            </button>
            <button type="button" className="ticket-confirm-btn" onClick={handleConfirm} disabled={updateStatus.isPending}>
              <CheckCircle2 size={16} aria-hidden="true" />
              Confirmar
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
      </div>
    </div>
  );
}
