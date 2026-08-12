import { useState } from "react";
import type { CompanySettings } from "@/api/client";

const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DAYS_PT = ["D", "S", "T", "Q", "Q", "S", "S"];

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function CalendarGrid({
  businessHours,
  selectedDate,
  onSelectDate,
}: {
  businessHours: CompanySettings["business_hours"];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function isDisabled(d: number): boolean {
    const dateStr = toDateStr(viewYear, viewMonth, d);
    if (dateStr < todayStr) return true;
    const dow = new Date(viewYear, viewMonth, d).getDay();
    return !businessHours[DOW_KEYS[dow]];
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  return (
    <div className="calendar-grid">
      <div className="calendar-nav">
        <button type="button" onClick={prevMonth} aria-label="Mês anterior">‹</button>
        <div className="calendar-title">{MONTHS_PT[viewMonth]} {viewYear}</div>
        <button type="button" onClick={nextMonth} aria-label="Mês seguinte">›</button>
      </div>
      <div className="calendar-dow-row">
        {DAYS_PT.map((d, i) => <div key={i} className="calendar-dow">{d}</div>)}
      </div>
      <div className="calendar-days">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="calendar-cell empty" />;
          const dateStr = toDateStr(viewYear, viewMonth, d);
          const disabled = isDisabled(d);
          const selected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          return (
            <button
              key={i}
              type="button"
              className={`calendar-cell ${disabled ? "disabled" : ""} ${selected ? "selected" : ""} ${isToday ? "today" : ""}`}
              disabled={disabled}
              onClick={() => onSelectDate(dateStr)}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className="availability-legend">
        <span className="availability-legend-item">
          <span className="availability-legend-dot is-open" /> Disponível
        </span>
        <span className="availability-legend-item">
          <span className="availability-legend-dot is-closed" /> Indisponível
        </span>
        <span className="availability-legend-item">
          <span className="availability-legend-dot is-selected" /> Selecionado
        </span>
      </div>
    </div>
  );
}
