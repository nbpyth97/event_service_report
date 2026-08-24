import type { Agendamento } from "@/api/client";
import { fmtDateTime } from "@/lib/format";

// wa.me wants digits only (country code + number, no "+", spaces, or dashes) —
// stripping non-digits is the documented way to normalize whatever format the
// number was entered in. text= is always sent explicitly, even empty — if we
// omit it, WhatsApp Web/Desktop keeps whatever draft was last left typed in
// that chat's composer (e.g. from opening "Atualizar cliente" first), so
// "Falar com" would appear to inherit the other button's prefilled message.
// An explicit empty text= forces the composer to actually clear.
export function waLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message ?? "")}`;
}

// "foi confirmado" vs "está pendente" — pending isn't a completed action yet,
// so it gets its own verb instead of an awkward "foi pendente".
const STATUS_PHRASE_PT: Record<Agendamento["status"], string> = {
  pending: "está pendente",
  confirmed: "foi confirmado",
  declined: "foi recusado",
  cancelled: "foi cancelado",
};

// The status-update message — what the "Atualizar cliente" button prefills
// to tell a customer where their booking stands.
export function statusUpdateMessage(agendamento: Pick<Agendamento, "customer_name" | "service_name" | "status" | "start_time">): string {
  const phrase = STATUS_PHRASE_PT[agendamento.status];
  return `Olá ${agendamento.customer_name}, seu agendamento de ${agendamento.service_name} ${phrase} às ${fmtDateTime(agendamento.start_time)}.`;
}
