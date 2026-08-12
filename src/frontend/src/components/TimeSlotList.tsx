import { useAvailability } from "@/hooks/queries";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export default function TimeSlotList({
  serviceId,
  date,
  selectedSlot,
  onSelectSlot,
}: {
  serviceId: string;
  date: string;
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
}) {
  const { data, isLoading } = useAvailability(serviceId, date);
  const slots = data?.slots ?? [];

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
      <div className="timeslot-grid">
        {slots.map((s) => (
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
  );
}
