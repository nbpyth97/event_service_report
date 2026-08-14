import type { Agendamento } from "@/api/client";
import { addDays, toDateStr } from "@/lib/date";

const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const WEEKDAY_LETTER_PT = ["S", "T", "Q", "Q", "S", "S", "D"]; // Mon..Sun

function startOfMonthGrid(monthAnchor: Date): Date {
  const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const dow = first.getDay(); // 0=Sun..6=Sat
  return addDays(first, dow === 0 ? -6 : 1 - dow); // back up to Monday
}

// Admin's month overview — a traditional 7×N grid, each cell a tap target
// that hands off to the day view for detail (a cell is too small to show
// real event cards, so it only needs to answer "is this day busy").
export default function CalendarMonthView({
  monthAnchor,
  agendamentos,
  onSelectDay,
}: {
  monthAnchor: Date;
  agendamentos: Agendamento[];
  onSelectDay: (date: Date) => void;
}) {
  const todayStr = toDateStr(new Date());
  const gridStart = startOfMonthGrid(monthAnchor);
  const lastOfMonth = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0);
  const lastDow = lastOfMonth.getDay(); // 0=Sun..6=Sat
  const gridEnd = addDays(lastOfMonth, lastDow === 0 ? 0 : 7 - lastDow); // forward to Sunday
  const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86_400_000) + 1;
  const days = Array.from({ length: totalDays }, (_, i) => addDays(gridStart, i));

  // Month view only has room to answer one question per cell — pending
  // bookings aren't settled yet, so counting them in here would blur "busy"
  // with "still needs a decision" (that's what the Calendário-tab default
  // and the pending-first list are for).
  const confirmedCountByDate = new Map<string, number>();
  for (const a of agendamentos) {
    if (a.status !== "confirmed") continue;
    const key = toDateStr(new Date(a.start_time));
    confirmedCountByDate.set(key, (confirmedCountByDate.get(key) ?? 0) + 1);
  }

  return (
    <div className="cal-month">
      <div className="cal-month-weekdays">
        {WEEKDAY_LETTER_PT.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
      <div className="cal-month-grid">
        {days.map((d) => {
          const dateStr = toDateStr(d);
          const isCurrentMonth = d.getMonth() === monthAnchor.getMonth();
          const isToday = dateStr === todayStr;
          const confirmedCount = confirmedCountByDate.get(dateStr) ?? 0;
          return (
            <button
              type="button"
              key={dateStr}
              className={`cal-month-cell${isCurrentMonth ? "" : " cal-month-cell-outside"}${isToday ? " cal-month-cell-today" : ""}`}
              onClick={() => onSelectDay(d)}
            >
              <span className="cal-month-cell-num">{d.getDate()}</span>
              {confirmedCount > 0 && <span className="cal-month-cell-badge">{confirmedCount}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function fmtMonthLabel(d: Date): string {
  const label = `${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}
