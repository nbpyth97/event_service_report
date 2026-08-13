import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { addDays, toDateStr } from "@/lib/date";

export interface DateRange {
  start: string;
  end: string;
}

export type DatePreset = "today" | "week" | "month" | "all" | "custom";

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mês" },
  { key: "all", label: "Tudo" },
  { key: "custom", label: "Personalizado" },
];

// Date-only strings ("YYYY-MM-DD") parsed with `new Date(str)` are read as
// UTC midnight, which can land on the wrong local day — parse the parts
// directly instead.
function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtDay(s: string): string {
  const d = parseDateStr(s);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  return addDays(d, day === 0 ? -6 : 1 - day);
}

export function computePresetRange(preset: DatePreset): DateRange {
  const today = new Date();
  if (preset === "today") {
    const s = toDateStr(today);
    return { start: s, end: s };
  }
  if (preset === "week") {
    const monday = startOfWeek(today);
    return { start: toDateStr(monday), end: toDateStr(addDays(monday, 6)) };
  }
  if (preset === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: toDateStr(first), end: toDateStr(last) };
  }
  return { start: "", end: "" };
}

function rangeLabel(preset: DatePreset, range: DateRange): string {
  if (preset === "today") return "Hoje";
  if (preset === "week") return range.start && range.end ? `Esta semana (${fmtDay(range.start)} – ${fmtDay(range.end)})` : "Esta semana";
  if (preset === "month") return "Este mês";
  if (preset === "all") return "Todo o período";
  if (range.start && range.end) return `${fmtDay(range.start)} – ${fmtDay(range.end)}`;
  if (range.start) return `A partir de ${fmtDay(range.start)}`;
  if (range.end) return `Até ${fmtDay(range.end)}`;
  return "Personalizado";
}

// Single full-width trigger instead of two bare date <select>-looking inputs
// with dead space — opens a preset row (Hoje/Esta semana/Este mês/Tudo), and
// "Personalizado" reveals the raw start/end date inputs for a manual range.
export default function AgendamentoDateRangePicker({
  preset,
  range,
  onPresetChange,
  onRangeChange,
}: {
  preset: DatePreset;
  range: DateRange;
  onPresetChange: (preset: DatePreset) => void;
  onRangeChange: (range: DateRange) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const selectPreset = (p: DatePreset) => {
    onPresetChange(p);
    if (p !== "custom") {
      onRangeChange(computePresetRange(p));
      setExpanded(false);
    }
  };

  return (
    <div className="agendamento-date-picker">
      <button
        type="button"
        className="agendamento-date-trigger"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="agendamento-date-trigger-label">
          <CalendarDays size={17} aria-hidden="true" />
          {rangeLabel(preset, range)}
        </span>
        <ChevronDown size={16} className={expanded ? "agendamento-date-chevron-open" : ""} aria-hidden="true" />
      </button>

      {expanded && (
        <div className="agendamento-date-panel">
          <div className="agendamento-date-presets">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={preset === p.key ? "active" : ""}
                onClick={() => selectPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="agendamento-filter-dates">
              <label className="agendamento-filter-date-field">
                <span>De</span>
                <input
                  type="date"
                  value={range.start}
                  max={range.end || undefined}
                  onChange={(e) => onRangeChange({ ...range, start: e.target.value })}
                  aria-label="Data inicial"
                />
              </label>
              <label className="agendamento-filter-date-field">
                <span>Até</span>
                <input
                  type="date"
                  value={range.end}
                  min={range.start || undefined}
                  onChange={(e) => onRangeChange({ ...range, end: e.target.value })}
                  aria-label="Data final"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
