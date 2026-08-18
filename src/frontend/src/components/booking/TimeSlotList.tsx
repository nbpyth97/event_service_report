function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

// Already-available slots only (the API never returns busy ones — see
// availability/service.py::_candidate_slots) grouped into Manhã/Tarde so a
// short-duration service's day (e.g. a 15-min Sobrancelha, up to ~44 slots
// in an 11h window) doesn't read as one undifferentiated wall of buttons.
// Split at the same hour a shift would naturally break for a walk-in salon,
// using the browser-local hour so the boundary matches whatever's on the
// button (fmtTime formats in the same local frame).
function groupByPeriod(slots: string[]): { label: string; slots: string[] }[] {
  const morning = slots.filter((s) => new Date(s).getHours() < 13);
  const afternoon = slots.filter((s) => new Date(s).getHours() >= 13);
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
