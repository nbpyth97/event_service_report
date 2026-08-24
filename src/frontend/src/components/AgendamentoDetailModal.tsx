import { useEffect, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, Euro, MessageCircle, StickyNote, User, X, XCircle } from "lucide-react";
import type { Agendamento } from "@/api/client";
import { useAgendamentoHistory, useUpdateAgendamentoStatus } from "@/hooks/queries";
import { useToast } from "@/lib/toast";
import { fmtDateTime, fmtPriceValue, fmtTime } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import StatusStepper, { stepIndexOf } from "@/components/StatusStepper";
import StatusHistoryStepper from "@/components/StatusHistoryStepper";
import NotifyWhatsappLink from "@/components/NotifyWhatsappLink";
import Button from "@/components/Button";
import { useEvent } from "@/lib/useEvent";

export default function AgendamentoDetailModal({
  agendamento,
  onClose,
}: {
  agendamento: Agendamento;
  onClose: () => void;
}) {
  const updateStatus = useUpdateAgendamentoStatus();
  const { data: history } = useAgendamentoHistory(agendamento.id);
  const { showSuccess } = useToast();
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const handleClose = useEvent(onClose);

  useEffect(() => {
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  const isEndedState = agendamento.status === "declined" || agendamento.status === "cancelled";
  const historyTimes = Object.fromEntries((history ?? []).map((h) => [h.to_status, h.changed_at])) as Partial<
    Record<Agendamento["status"], string>
  >;

  const handleConfirm = () => {
    updateStatus.mutate(
      { id: agendamento.id, status: "confirmed" },
      {
        onSuccess: () => {
          showSuccess(`Marcação de ${agendamento.customer_known_name} confirmada.`);
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
          showSuccess(`Marcação de ${agendamento.customer_known_name} recusada.`);
          onClose();
        },
      }
    );
    setConfirmingDecline(false);
  };

  const handleCancel = () => {
    updateStatus.mutate(
      { id: agendamento.id, status: "cancelled" },
      {
        onSuccess: () => {
          showSuccess(`Marcação de ${agendamento.customer_known_name} cancelada.`);
          onClose();
        },
      }
    );
    setConfirmingCancel(false);
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
            history stepper, active or ended — since "send a status update"
            is contextually tied to the status itself, not to the client's
            identity below. */}
        {isEndedState ? (
          <div className="status-stepper-row">
            <StatusHistoryStepper history={history ?? []} />
            {agendamento.customer_phone && agendamento.status === "declined" && (
              <NotifyWhatsappLink agendamento={agendamento} size={14} />
            )}
          </div>
        ) : (
          <div className="status-stepper-row">
            <StatusStepper stepIndex={stepIndexOf(agendamento)} timestamps={historyTimes} />
            {agendamento.customer_phone && agendamento.status === "confirmed" && (
              <NotifyWhatsappLink agendamento={agendamento} size={14} />
            )}
          </div>
        )}

        <div className="modal-sheet-body">
          <div className="modal-meta-card">
            <div className="ticket-row">
              <User size={14} aria-hidden="true" />
              <span className="ticket-customer-name">{agendamento.customer_known_name}</span>
              {agendamento.customer_phone && (
                <a
                  href={waLink(agendamento.customer_phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ticket-whatsapp-link"
                  aria-label={`Falar com ${agendamento.customer_known_name} via WhatsApp`}
                  title="Falar com o cliente"
                >
                  <MessageCircle size={13} aria-hidden="true" />
                </a>
              )}
            </div>
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

          {agendamento.notes && (
            <div className="modal-notes-card">
              <p className="modal-notes-label">
                <StickyNote size={13} aria-hidden="true" />
                Nota do cliente
              </p>
              <p className="modal-notes-text">{agendamento.notes}</p>
            </div>
          )}
        </div>

        {agendamento.status === "pending" && !confirmingDecline && (
          <div className="ticket-actions">
            <Button variant="danger-outline" onClick={() => setConfirmingDecline(true)} disabled={updateStatus.isPending}>
              <XCircle size={16} aria-hidden="true" />
              Recusar
            </Button>
            <Button variant="confirm" onClick={handleConfirm} disabled={updateStatus.isPending}>
              <CheckCircle2 size={16} aria-hidden="true" />
              Confirmar
            </Button>
          </div>
        )}

        {confirmingDecline && (
          <div className="ticket-decline-confirm">
            <p>Recusar a marcação de {agendamento.customer_known_name}?</p>
            <Button variant="cancel" onClick={() => setConfirmingDecline(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDecline} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? "A recusar…" : "Sim, recusar"}
            </Button>
          </div>
        )}

        {agendamento.status === "confirmed" && !confirmingCancel && (
          <div className="ticket-actions">
            <Button variant="danger-outline" onClick={() => setConfirmingCancel(true)} disabled={updateStatus.isPending}>
              <XCircle size={16} aria-hidden="true" />
              Cancelar marcação
            </Button>
          </div>
        )}

        {confirmingCancel && (
          <div className="ticket-decline-confirm">
            <p>Cancelar a marcação de {agendamento.customer_known_name}?</p>
            <Button variant="cancel" onClick={() => setConfirmingCancel(false)}>
              Voltar
            </Button>
            <Button variant="danger" onClick={handleCancel} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? "A cancelar…" : "Sim, cancelar"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
