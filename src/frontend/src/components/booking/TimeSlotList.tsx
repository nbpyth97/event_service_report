import { fmtTime } from "@/lib/format";
import { zonedParts } from "@/lib/tz";

// Already-available slots only (the API never returns busy ones — see
// availability/service.py::_candidate_slots) grouped into Manhã/Tarde so a
// short-duration service's day (e.g. a 15-min Sobrancelha, up to ~44 slots
// in an 11h window) doesn't read as one undifferentiated wall of buttons.
// Boundary is midday: 12:00 reads as "tarde" in pt-PT, so meio-dia heads the
// afternoon rather than trailing the morning. Read in the company's zone so
// the group a button lands in always matches the time printed on it (fmtTime
// renders in that same frame).
const AFTERNOON_FROM_HOUR = 12;

function groupByPeriod(slots: string[]): { label: string; slots: string[] }[] {
  const morning = slots.filter((s) => zonedParts(s).hour < AFTERNOON_FROM_HOUR);
  const afternoon = slots.filter((s) => zonedParts(s).hour >= AFTERNOON_FROM_HOUR);
  return [
    { label: "Manhã", slots: morning },
    { label: "Tarde", slots: afternoon },
  ].filter((p) => p.slots.length > 0);
}

// Presentational — the caller fetches. The two booking surfaces read from
// different endpoints (authenticated useAvailability vs. the tenant-slug
// scoped usePublicAvailability), and taking the slots as a prop is what lets
// one component serve both instead of one copy per endpoint.
export default function TimeSlotList({
  slots,
  isLoading,
  selectedSlot,
  onSelectSlot,
}: {
  slots: string[];
  isLoading: boolean;
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
}) {
  return (
    <div className="timeslot-list">
      <div className="timeslot-title">Horários disponíveis</div>
      {isLoading && (
        <div className="timeslot-skeleton" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="timeslot-skeleton-item" />
          ))}
        </div>
      )}
      {!isLoading && slots.length === 0 && (
        <div className="empty-state">
          <p>Sem horários disponíveis neste dia.</p>
          <p>Escolha outro dia no calendário — os dias em azul têm vaga.</p>
        </div>
      )}
      {groupByPeriod(slots).map((period) => (
        <div key={period.label} className="timeslot-period">
          <div className="timeslot-period-label">{period.label}</div>
          <div className="timeslot-grid">
            {period.slots.map((s) => (
              <button
                key={s}
                type="button"
                className={`timeslot-btn ${s === selectedSlot ? "selected" : ""}`}
                onClick={() => onSelectSlot(s)}
              >
                {fmtTime(s)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
