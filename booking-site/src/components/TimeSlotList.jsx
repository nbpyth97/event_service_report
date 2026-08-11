import { useEffect, useState } from 'react';
import { fetchAvailability } from '../lib/api';

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

export default function TimeSlotList({ tenant, gender, serviceSlug, date, selectedSlot, onSelectSlot }) {
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setSlots(null);
    setError(null);
    fetchAvailability({ tenant, gender, service: serviceSlug, date })
      .then((data) => { if (!cancelled) setSlots(data.slots); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [tenant, gender, serviceSlug, date]);

  return (
    <div className="timeslot-list">
      <div className="timeslot-title">Horários disponíveis</div>
      {error && <p className="error-msg">{error}</p>}
      {!error && slots === null && <p className="muted">A carregar horários…</p>}
      {!error && slots?.length === 0 && <p className="muted">Sem horários disponíveis neste dia.</p>}
      <div className="timeslot-grid">
        {slots?.map((s) => (
          <button
            key={s}
            type="button"
            className={`timeslot-btn ${s === selectedSlot ? 'selected' : ''}`}
            onClick={() => onSelectSlot(s)}
          >
            {fmtTime(s)}
          </button>
        ))}
      </div>
    </div>
  );
}
