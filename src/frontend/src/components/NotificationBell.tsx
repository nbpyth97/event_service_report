import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, X } from "lucide-react";
import type { Notification } from "@/api/client";
import StatusChip from "@/components/StatusChip";
import Button from "@/components/Button";
import { useMarkNotificationRead, useNotifications, useUpdateAgendamentoStatus } from "@/hooks/queries";
import { useToast } from "@/lib/toast";
import { fmtDateTime } from "@/lib/format";

// Every notification's message is generated server-side (see
// notifications/service.py) as "<Prefixo>: <Cliente> — <Serviço>" — parsing
// it here avoids duplicating customer/service as separate API fields for a
// shape the backend already guarantees, while letting the card show them as
// its own title/subtitle instead of one long sentence.
function parseNotification(message: string): { customer: string; service: string } {
  const afterPrefix = message.slice(message.indexOf(": ") + 2);
  const [customer, service] = afterPrefix.split(" — ");
  return { customer: customer || message, service: service ?? "" };
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const updateStatus = useUpdateAgendamentoStatus();
  const { showSuccess } = useToast();
  const navigate = useNavigate();
  const unreadCount = notifications?.length ?? 0;

  // Two groups, not a filter switch — with only two notification types,
  // splitting "still needs a decision" from "already resolved, FYI" tells
  // the admin more at a glance than a tab bar would over a list this short.
  const { pending, cancelled } = useMemo(() => {
    const pending: Notification[] = [];
    const cancelled: Notification[] = [];
    for (const n of notifications ?? []) {
      (n.type === "booking_pending" ? pending : cancelled).push(n);
    }
    return { pending, cancelled };
  }, [notifications]);

  // GET /notifications only ever returns unread rows, so marking one read
  // is what removes it from the list — the refetch after invalidation
  // drops it for good, surviving a page reload (no local dismiss state).
  const handleOpenDetail = (n: Notification) => {
    markRead.mutate(n.id);
    setOpen(false);
    if (n.agendamento_id) navigate(`/agendamentos?highlight=${n.agendamento_id}`);
  };

  // Confirming/declining resolves the "new booking" notification server-side
  // (see resolve_booking_pending), so the card just disappears from the
  // Requer ação group on its own once the mutation's cache invalidation
  // lands — no separate markRead call needed here.
  const handleDecide = (n: Notification, status: "confirmed" | "declined") => {
    if (!n.agendamento_id) return;
    const { customer } = parseNotification(n.message);
    updateStatus.mutate(
      { id: n.agendamento_id, status },
      {
        onSuccess: () =>
          showSuccess(`Marcação de ${customer} ${status === "confirmed" ? "confirmada" : "recusada"}.`),
      }
    );
  };

  return (
    <div className="notification-bell">
      <Button
        variant="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : "Notificações"}
        title="Notificações"
      >
        <Bell size={17} aria-hidden="true" />
        {unreadCount > 0 && <span className="notification-bell-badge">{unreadCount}</span>}
      </Button>
      {open && (
        <>
          <div className="reminder-panel-backdrop" onClick={() => setOpen(false)} />
          <div className="reminder-panel">
            <div className="reminder-panel-header">
              <span className="reminder-panel-title">Notificações</span>
              <Button variant="link" onClick={() => setOpen(false)}>
                Fechar
              </Button>
            </div>
            {!notifications || notifications.length === 0 ? (
              <p className="reminder-panel-empty">Sem notificações.</p>
            ) : (
              <>
                {pending.length > 0 && (
                  <section className="notif-group">
                    <h4 className="notif-group-title">Requer ação</h4>
                    <ul className="reminder-panel-list">
                      {pending.map((n) => {
                        const { customer, service } = parseNotification(n.message);
                        return (
                          <li key={n.id} className="reminder-panel-item notif-card">
                            <div
                              className="notif-card-trigger"
                              role="button"
                              tabIndex={0}
                              onClick={() => handleOpenDetail(n)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleOpenDetail(n);
                              }}
                            >
                              <div className="notif-card-top">
                                <span className="notif-card-customer">{customer}</span>
                                <StatusChip status="pending" />
                              </div>
                              {service && <span className="notif-card-service">{service}</span>}
                              <span className="reminder-panel-item-time">{fmtDateTime(n.created_at)}</span>
                            </div>
                            <div className="notif-card-actions">
                              <Button
                                variant="confirm"
                                className="notif-action-btn"
                                disabled={updateStatus.isPending}
                                onClick={() => handleDecide(n, "confirmed")}
                              >
                                <Check size={13} aria-hidden="true" />
                                Confirmar
                              </Button>
                              <Button
                                variant="danger-outline"
                                className="notif-action-btn"
                                disabled={updateStatus.isPending}
                                onClick={() => handleDecide(n, "declined")}
                              >
                                <X size={13} aria-hidden="true" />
                                Recusar
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {cancelled.length > 0 && (
                  <section className="notif-group">
                    <h4 className="notif-group-title">Histórico</h4>
                    <ul className="reminder-panel-list">
                      {cancelled.map((n) => {
                        const { customer, service } = parseNotification(n.message);
                        return (
                          <li key={n.id}>
                            <button
                              type="button"
                              className="reminder-panel-item notif-card"
                              onClick={() => handleOpenDetail(n)}
                            >
                              <div className="notif-card-top">
                                <span className="notif-card-customer">{customer}</span>
                                <StatusChip status="cancelled" />
                              </div>
                              {service && <span className="notif-card-service">{service}</span>}
                              <span className="reminder-panel-item-time">{fmtDateTime(n.created_at)}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
