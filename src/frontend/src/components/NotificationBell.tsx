import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import type { Notification } from "@/api/client";
import { useMarkNotificationRead, useNotifications } from "@/hooks/queries";
import { fmtDateTime } from "@/lib/format";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const navigate = useNavigate();
  const unreadCount = notifications?.length ?? 0;

  // GET /notifications only ever returns unread rows, so marking one read
  // is what removes it from the list — the refetch after invalidation
  // drops it for good, surviving a page reload (no local dismiss state).
  const handleItemClick = (n: Notification) => {
    markRead.mutate(n.id);
    setOpen(false);
    if (n.agendamento_id) navigate(`/agendamentos?highlight=${n.agendamento_id}`);
  };

  return (
    <div className="notification-bell">
      <button
        type="button"
        className="app-nav-logout"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : "Notificações"}
        title="Notificações"
      >
        <Bell size={17} aria-hidden="true" />
        {unreadCount > 0 && <span className="notification-bell-badge">{unreadCount}</span>}
      </button>
      {open && (
        <>
          <div className="reminder-panel-backdrop" onClick={() => setOpen(false)} />
          <div className="reminder-panel">
            <div className="reminder-panel-header">
              <span className="reminder-panel-title">Notificações</span>
              <button type="button" className="reminder-panel-close" onClick={() => setOpen(false)}>
                Fechar
              </button>
            </div>
            {!notifications || notifications.length === 0 ? (
              <p className="reminder-panel-empty">Sem notificações.</p>
            ) : (
              <ul className="reminder-panel-list">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className="reminder-panel-item reminder-panel-item-unread"
                      onClick={() => handleItemClick(n)}
                    >
                      <span className="reminder-panel-item-message">{n.message}</span>
                      <span className="reminder-panel-item-time">{fmtDateTime(n.created_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
