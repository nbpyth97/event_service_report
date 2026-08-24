import { Bell, BellRing } from "lucide-react";
import type { Agendamento } from "@/api/client";
import { useNotifyAgendamento } from "@/hooks/queries";
import { statusUpdateMessage, waLink } from "@/lib/whatsapp";

// The status-update wa.me link (confirmed/declined) — opening it fires
// PATCH /notify alongside so "already messaged" persists across
// devices/refreshes instead of living only in frontend state. A real <a
// href> left to the browser's own click handling, not an onClick redirect,
// so it can't be mistaken for (or blocked like) a popup.
export default function NotifyWhatsappLink({
  agendamento,
  size = 13,
  className = "",
}: {
  agendamento: Agendamento;
  size?: number;
  className?: string;
}) {
  const notify = useNotifyAgendamento();
  const alreadyNotified = Boolean(agendamento.notified_at);

  return (
    <a
      href={waLink(agendamento.customer_phone ?? "", statusUpdateMessage(agendamento))}
      target="_blank"
      rel="noopener noreferrer"
      className={`ticket-whatsapp-link ticket-whatsapp-link-alert ${alreadyNotified ? "ticket-whatsapp-link-notified" : ""} ${className}`}
      aria-label={
        alreadyNotified
          ? `Reenviar atualização a ${agendamento.customer_name} via WhatsApp`
          : `Atualizar ${agendamento.customer_name} sobre o estado da marcação via WhatsApp`
      }
      title={alreadyNotified ? "Notificado — reenviar" : "Enviar atualização de estado"}
      onClick={(e) => {
        e.stopPropagation();
        notify.mutate(agendamento.id);
      }}
    >
      {alreadyNotified ? <Bell size={size} aria-hidden="true" /> : <BellRing size={size} aria-hidden="true" />}
    </a>
  );
}
