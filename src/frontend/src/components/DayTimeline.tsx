import { useState } from "react";
import type { Agendamento, CompanySettings } from "@/api/client";
import { addDays, dowKeyOf, toDateStr } from "@/lib/date";

const WEEKDAY_PT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MONTHS_PT_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fmtHeading(d: Date): string {
  return `${WEEKDAY_PT[d.getDay()]}, ${d.getDate()} de ${MONTHS_PT_SHORT[d.getMonth()]}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

// Admin's "can I fit someone in" view — one horizontal bar per day spanning
// business hours, with each pending/confirmed booking drawn as a block sized
// to its real duration. Declined/cancelled bookings free up their slot again,
// so (matching the backend's own busy-check) they're left off the bar.
export default function DayTimeline({
  businessHours,
  agendamentos,
}: {
  businessHours: CompanySettings["business_hours"];
  agendamentos: Agendamento[];
}) {
  const [date, setDate] = useState(() => new Date());
  const dateStr = toDateStr(date);
  const todayStr = toDateStr(new Date());
  const hours = businessHours[dowKeyOf(date)];

  const dayBookings = agendamentos
    .filter((a) => (a.status === "pending" || a.status === "confirmed") && toDateStr(new Date(a.start_time)) === dateStr)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div className="day-timeline">
      <div className="day-timeline-nav">
        <button type="button" onClick={() => setDate((d) => addDays(d, -1))} aria-label="Dia anterior">‹</button>
        <div className="day-timeline-heading">
          <strong>{fmtHeading(date)}</strong>
          {dateStr !== todayStr && (
            <button type="button" className="day-timeline-today" onClick={() => setDate(new Date())}>
              Hoje
            </button>
          )}
        </div>
        <button type="button" onClick={() => setDate((d) => addDays(d, 1))} aria-label="Dia seguinte">›</button>
      </div>

      {!hours ? (
        <p className="muted day-timeline-closed">Fechado neste dia.</p>
      ) : (
        <>
          <div className="day-timeline-bar-wrap">
            <span className="day-timeline-edge">{hours.open}</span>
            <div className="day-timeline-bar">
              {dayBookings.map((a) => {
                const openMin = toMinutes(hours.open);
                const closeMin = toMinutes(hours.close);
                const span = closeMin - openMin;
                const start = new Date(a.start_time);
                const end = new Date(a.end_time);
                const startMin = Math.max(openMin, start.getHours() * 60 + start.getMinutes());
                const endMin = Math.min(closeMin, end.getHours() * 60 + end.getMinutes());
                const left = ((startMin - openMin) / span) * 100;
                const width = Math.max(((endMin - startMin) / span) * 100, 2.5);
                return (
                  <div
                    key={a.id}
                    className={`day-timeline-block day-timeline-block-${a.status}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${fmtTime(a.start_time)}–${fmtTime(a.end_time)} · ${a.customer_name} · ${a.service_name}`}
                  >
                    <span className="day-timeline-block-label">{a.customer_name}</span>
                  </div>
                );
              })}
            </div>
            <span className="day-timeline-edge">{hours.close}</span>
          </div>
          {dayBookings.length === 0 && <p className="muted day-timeline-empty">Dia livre — nenhuma marcação ainda.</p>}
        </>
      )}
    </div>
  );
}
