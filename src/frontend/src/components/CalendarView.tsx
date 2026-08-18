import { useState } from "react";
import type { Agendamento, CompanySettings } from "@/api/client";
import { addDays, startOfWeek, toDateStr } from "@/lib/date";
import AdminCalendarGrid from "@/components/AdminCalendarGrid";
import CalendarMonthView, { fmtMonthLabel } from "@/components/CalendarMonthView";

type CalendarViewMode = "day" | "week" | "month";

const WEEKDAY_FULL_PT = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MONTHS_PT_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function fmtDayLabel(d: Date): string {
  const label = `${WEEKDAY_FULL_PT[d.getDay()]}, ${d.getDate()} de ${MONTHS_PT_SHORT[d.getMonth()]}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fmtWeekLabel(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = `${start.getDate()}${sameMonth ? "" : ` ${MONTHS_PT_SHORT[start.getMonth()]}`}`;
  return `${startLabel} – ${end.getDate()} ${MONTHS_PT_SHORT[end.getMonth()]}`;
}

// Admin's "Calendário" tab — a Day/Week/Month view switcher over the same
// underlying bookings, each optimized for a different zoom level: Day for
// working a single day's schedule, Week for the week's shape, Month for
// spotting busy/quiet stretches at a glance. Switching views keeps the same
// focus date in view rather than resetting to today.
export default function CalendarView({
  agendamentos,
  businessHours,
  highlightedId,
}: {
  agendamentos: Agendamento[];
  businessHours: CompanySettings["business_hours"];
  highlightedId?: string | null;
}) {
  const highlightedTarget = highlightedId ? agendamentos.find((a) => a.id === highlightedId) : undefined;
  const [view, setView] = useState<CalendarViewMode>(highlightedTarget ? "day" : "week");
  const [selectedDate, setSelectedDate] = useState(() => (highlightedTarget ? new Date(highlightedTarget.start_time) : new Date()));

  const todayStr = toDateStr(new Date());
  const weekStart = startOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekContainsToday = weekDays.some((d) => toDateStr(d) === todayStr);
  const isCurrentMonth = selectedDate.getFullYear() === new Date().getFullYear() && selectedDate.getMonth() === new Date().getMonth();

  const showToday = view === "day" ? toDateStr(selectedDate) !== todayStr : view === "week" ? !weekContainsToday : !isCurrentMonth;

  const goToday = () => setSelectedDate(new Date());
  const goPrev = () => {
    if (view === "day") setSelectedDate((d) => addDays(d, -1));
    else if (view === "week") setSelectedDate((d) => addDays(d, -7));
    else setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const goNext = () => {
    if (view === "day") setSelectedDate((d) => addDays(d, 1));
    else if (view === "week") setSelectedDate((d) => addDays(d, 7));
    else setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };
  const selectDay = (d: Date) => {
    setSelectedDate(d);
    setView("day");
  };

  const label = view === "day" ? fmtDayLabel(selectedDate) : view === "week" ? fmtWeekLabel(weekDays[0], weekDays[6]) : fmtMonthLabel(selectedDate);

  return (
    <div className="cal-view">
      <div className="agendamento-mode-switch cal-view-switch" role="tablist" aria-label="Zoom do calendário">
        {(["day", "week", "month"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            className={view === v ? "active" : ""}
            onClick={() => setView(v)}
          >
            {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
          </button>
        ))}
      </div>

      <div className="cal-nav">
        <button type="button" onClick={goPrev} aria-label="Anterior">
          ‹
        </button>
        <div className="cal-nav-heading">
          <strong>{label}</strong>
          {showToday && (
            <button type="button" className="cal-nav-today" onClick={goToday}>
              Hoje
            </button>
          )}
        </div>
        <button type="button" onClick={goNext} aria-label="Seguinte">
          ›
        </button>
      </div>

      {view === "month" ? (
        <CalendarMonthView monthAnchor={selectedDate} agendamentos={agendamentos} onSelectDay={selectDay} />
      ) : (
        <AdminCalendarGrid
          variant={view}
          days={view === "day" ? [selectedDate] : weekDays}
          businessHours={businessHours}
          agendamentos={agendamentos}
          highlightedId={highlightedId}
          onSelectDay={selectDay}
        />
      )}
    </div>
  );
}
