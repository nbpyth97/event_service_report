import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Agendamento, CompanySettings } from "@/api/client";
import { dowKeyOf, toDateStr } from "@/lib/date";
import { layoutDayEvents, toMinutes } from "@/lib/calendarLayout";
import { useCurrentUser } from "@/auth/user";
import AgendamentoDetailModal from "@/components/AgendamentoDetailModal";

const WEEKDAY_SHORT_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// Fallback window when every visible day is closed — an empty grid with no
// time axis at all reads as broken, not "no bookings".
const DEFAULT_OPEN_MIN = 9 * 60;
const DEFAULT_CLOSE_MIN = 18 * 60;

// Day view gets a roomier scale (one wide column, more reading room per
// card); week view is more compact so a whole week's shape still fits.
const PX_PER_MIN: Record<"day" | "week", number> = { day: 1.35, week: 1.0 };
const MIN_BLOCK_PX = 24;

// Below this, the card only has room for its title row (padding + one line);
// a second line for the service name would get clipped by overflow:hidden,
// so it's better left off entirely — the native `title` tooltip on the card
// still carries the full "name · service" text for short bookings.
const SUBTITLE_MIN_HEIGHT_PX = 34;

// Admin's day/week grid — hour rows on one axis, day column(s) on the
// other, each pending/confirmed booking drawn as a card sized and
// positioned to its real time. Day view is just this same grid with a
// single day column, so both share one implementation. (Not to be confused
// with the customer-facing month date-picker in components/CalendarGrid.tsx
// — different tool, different audience, hence the separate file.)
export default function AdminCalendarGrid({
  variant,
  days,
  businessHours,
  agendamentos,
  highlightedId,
}: {
  variant: "day" | "week";
  days: Date[];
  businessHours: CompanySettings["business_hours"];
  agendamentos: Agendamento[];
  highlightedId?: string | null;
}) {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const pxPerMin = PX_PER_MIN[variant];

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!highlightedId) return;
    const el = scrollRef.current?.querySelector(`[data-agendamento-id="${highlightedId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [highlightedId]);

  // Navigating to a different day/week (‹ › arrows) starts back at the top
  // of the grid instead of keeping whatever scroll position the previous
  // day happened to be left at. Skipped on the very first render so it
  // doesn't fight the highlighted-booking scroll-into-view above.
  const isFirstDaysRender = useRef(true);
  const daysKey = days.map((d) => toDateStr(d)).join(",");
  useEffect(() => {
    if (isFirstDaysRender.current) {
      isFirstDaysRender.current = false;
      return;
    }
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [daysKey]);

  const todayStr = toDateStr(new Date());
  const dayHours = days.map((d) => businessHours[dowKeyOf(d)]);
  const openDayHours = dayHours.filter((h): h is { open: string; close: string } => Boolean(h));
  const gridStartMin =
    openDayHours.length > 0 ? Math.floor(Math.min(...openDayHours.map((h) => toMinutes(h.open))) / 60) * 60 : DEFAULT_OPEN_MIN;
  const gridEndMin =
    openDayHours.length > 0 ? Math.ceil(Math.max(...openDayHours.map((h) => toMinutes(h.close))) / 60) * 60 : DEFAULT_CLOSE_MIN;
  const gridHeight = (gridEndMin - gridStartMin) * pxPerMin;

  const hourMarks: number[] = [];
  for (let m = gridStartMin; m <= gridEndMin; m += 60) hourMarks.push(m);

  const eventsByDay = useMemo(() => {
    return days.map((d) => {
      const dateStr = toDateStr(d);
      const hours = businessHours[dowKeyOf(d)];
      if (!hours) return [];
      const dayItems = agendamentos.filter((a) => a.status === "confirmed" && toDateStr(new Date(a.start_time)) === dateStr);
      return layoutDayEvents(dayItems, gridStartMin, toMinutes(hours.open), toMinutes(hours.close), pxPerMin, MIN_BLOCK_PX);
    });
  }, [days, agendamentos, businessHours, gridStartMin, pxPerMin]);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMin - gridStartMin) * pxPerMin;

  const selected = agendamentos.find((a) => a.id === selectedId) ?? null;

  return (
    <div className={`cal-grid-scroll cal-grid-${variant}`} ref={scrollRef}>
      <div className="cal-grid">
        <div className="cal-grid-corner" />
        {days.map((d) => {
          const dateStr = toDateStr(d);
          const isToday = dateStr === todayStr;
          return (
            <div key={dateStr} className={`cal-grid-day-head${isToday ? " cal-grid-day-head-today" : ""}`}>
              {variant === "week" && (
                <>
                  <span className="cal-grid-day-name">{WEEKDAY_SHORT_PT[d.getDay()]}</span>
                  <span className="cal-grid-day-num">{d.getDate()}</span>
                </>
              )}
            </div>
          );
        })}

        <div className="cal-grid-gutter" style={{ height: gridHeight }}>
          {hourMarks.map((m) => (
            <span
              key={m}
              className={`cal-grid-hour-label${m === gridStartMin ? " cal-grid-hour-label-first" : ""}${
                m === gridEndMin ? " cal-grid-hour-label-last" : ""
              }`}
              style={{ top: (m - gridStartMin) * pxPerMin }}
            >
              {String(Math.floor(m / 60)).padStart(2, "0")}:00
            </span>
          ))}
        </div>

        {days.map((d, i) => {
          const dateStr = toDateStr(d);
          const hours = dayHours[i];
          const isToday = dateStr === todayStr;
          return (
            <div
              key={dateStr}
              className={`cal-grid-day-col${isToday ? " cal-grid-day-col-today" : ""}`}
              style={{ height: gridHeight, backgroundSize: `100% ${60 * pxPerMin}px` }}
            >
              {!hours ? (
                <div className="cal-grid-closed-day">
                  <span>Fechado</span>
                </div>
              ) : (
                <>
                  {toMinutes(hours.open) > gridStartMin && (
                    <div className="cal-grid-out-of-hours" style={{ top: 0, height: (toMinutes(hours.open) - gridStartMin) * pxPerMin }} />
                  )}
                  {toMinutes(hours.close) < gridEndMin && (
                    <div
                      className="cal-grid-out-of-hours"
                      style={{
                        top: (toMinutes(hours.close) - gridStartMin) * pxPerMin,
                        height: (gridEndMin - toMinutes(hours.close)) * pxPerMin,
                      }}
                    />
                  )}
                </>
              )}

              {isToday && nowTop >= 0 && nowTop <= gridHeight && <div className="cal-grid-now-line" style={{ top: nowTop }} />}

              {eventsByDay[i].map(({ agendamento, top, height, col, colCount }) => {
                const showDetails = height >= SUBTITLE_MIN_HEIGHT_PX;
                return (
                  <button
                    type="button"
                    key={agendamento.id}
                    data-agendamento-id={agendamento.id}
                    className={`cal-grid-card cal-grid-card-confirmed${
                      agendamento.id === highlightedId ? " cal-grid-card-highlighted" : ""
                    }`}
                    style={{
                      top,
                      height,
                      left: `${(col / colCount) * 100}%`,
                      width: `calc(${100 / colCount}% - 3px)`,
                    }}
                    onClick={() => setSelectedId(agendamento.id)}
                    title={
                      isAdmin
                        ? `${agendamento.customer_name} · ${agendamento.service_name}`
                        : agendamento.service_name
                    }
                  >
                    <span className="cal-grid-card-head">
                      <span className="cal-grid-card-title">{isAdmin ? agendamento.customer_name : agendamento.service_name}</span>
                      <CheckCircle2 className="cal-grid-card-icon" size={11} aria-hidden="true" />
                    </span>
                    {showDetails && isAdmin && (
                      <span className="cal-grid-card-subtitle">{agendamento.service_name}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {selected && <AgendamentoDetailModal agendamento={selected} isAdmin={isAdmin} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
