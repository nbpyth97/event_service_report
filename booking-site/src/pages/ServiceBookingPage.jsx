import { useParams, Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { findService } from '../lib/services';
import { tenantConfig, tenantServices, TENANT_SLUG } from '../lib/tenant';
import CalendarGrid from '../components/CalendarGrid';
import TimeSlotList from '../components/TimeSlotList';
import BookingForm from '../components/BookingForm';
import ResultScreen from '../components/ResultScreen';

function fmtPrice(n) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function ServiceBookingPage() {
  const { gender, serviceSlug } = useParams();
  const service = useMemo(() => findService(tenantServices, gender, serviceSlug), [gender, serviceSlug]);

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [result, setResult] = useState(null);

  if (!service) {
    return (
      <div className="page">
        <p>Serviço não encontrado. <Link to="/">Voltar</Link></p>
      </div>
    );
  }

  if (result?.ok) {
    return <ResultScreen success service={service} />;
  }

  return (
    <div className="page">
      <header className="header">
        <Link to="/" className="back-link">&larr; Todos os serviços</Link>
        <h1>{service.name}</h1>
        <p className="sub">{service.duration_min} min · {fmtPrice(service.price)}</p>
      </header>

      <div className="booking-layout">
        <CalendarGrid
          businessHours={tenantConfig.business_hours}
          selectedDate={selectedDate}
          onSelectDate={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
        />

        {selectedDate && (
          <TimeSlotList
            tenant={TENANT_SLUG}
            gender={gender}
            serviceSlug={serviceSlug}
            date={selectedDate}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
          />
        )}
      </div>

      {selectedSlot && (
        <BookingForm
          tenant={TENANT_SLUG}
          gender={gender}
          serviceSlug={serviceSlug}
          date={selectedDate}
          start={selectedSlot}
          onResult={setResult}
        />
      )}

      {result?.error && <p className="error-msg">{result.error}</p>}
    </div>
  );
}
