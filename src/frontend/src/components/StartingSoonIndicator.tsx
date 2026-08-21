import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Timer } from "lucide-react";
import { useStartingSoon } from "@/hooks/useStartingSoon";
import { fmtDateTime } from "@/lib/format";
import Button from "@/components/Button";

export default function StartingSoonIndicator() {
  const [open, setOpen] = useState(false);
  const startingSoon = useStartingSoon();
  const navigate = useNavigate();

  const handleItemClick = (agendamentoId: string) => {
    setOpen(false);
    navigate(`/agendamentos?highlight=${agendamentoId}`);
  };

  return (
    <div className="notification-bell">
      <Button
        variant="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label={startingSoon.length > 0 ? `Lembretes (${startingSoon.length})` : "Lembretes"}
        title="Lembretes"
      >
        <Timer size={17} aria-hidden="true" />
        {startingSoon.length > 0 && (
          <span className="notification-bell-badge starting-soon-badge">{startingSoon.length}</span>
        )}
      </Button>
      {open && (
        <>
          <div className="reminder-panel-backdrop" onClick={() => setOpen(false)} />
          <div className="reminder-panel">
            <div className="reminder-panel-header">
              <span className="reminder-panel-title">Lembretes</span>
              <Button variant="link" onClick={() => setOpen(false)}>
                Fechar
              </Button>
            </div>
            {startingSoon.length === 0 ? (
              <p className="reminder-panel-empty">Nada começando nos próximos 30 min.</p>
            ) : (
              <ul className="reminder-panel-list">
                {startingSoon.map((a) => (
                  <li key={a.id}>
                    <button type="button" className="reminder-panel-item" onClick={() => handleItemClick(a.id)}>
                      <span className="reminder-panel-item-message">
                        {a.service_name} — {a.customer_known_name}
                      </span>
                      <span className="reminder-panel-item-time">{fmtDateTime(a.start_time)}</span>
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
