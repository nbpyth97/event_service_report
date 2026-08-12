import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CalendarGrid from "@/components/CalendarGrid";
import TimeSlotList from "@/components/TimeSlotList";
import { useCreateAgendamento, useMyCompany, useServices } from "@/hooks/queries";
import { useToast } from "@/lib/toast";

function fmtPrice(price: string): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Number(price));
}

function fmtSlot(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BookingPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { data: services } = useServices();
  const { data: company } = useMyCompany();
  const createAgendamento = useCreateAgendamento();
  const { showSuccess } = useToast();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const service = services?.find((s) => s.id === serviceId);

  if (services && !service) {
    return (
      <div className="page">
        <p>Serviço não encontrado. <Link to="/services">Voltar</Link></p>
      </div>
    );
  }

  const handleConfirm = () => {
    if (!serviceId || !selectedSlot) return;
    createAgendamento.mutate(
      { service_id: serviceId, start_time: selectedSlot },
      {
        onSuccess: () => {
          showSuccess("Marcação enviada — aguarde a confirmação do salão.");
          navigate("/agendamentos");
        },
      }
    );
  };

  return (
    <div className="page">
      <Link to="/services" className="back-link">&larr; Todos os serviços</Link>
      {service && (
        <header className="booking-header">
          <h1>{service.name}</h1>
          <p className="sub">{service.duration_min} min · {fmtPrice(service.price)}</p>
        </header>
      )}

      {company && (
        <div className="booking-layout">
          <CalendarGrid
            businessHours={company.settings.business_hours}
            selectedDate={selectedDate}
            onSelectDate={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
          />
          {selectedDate && serviceId && (
            <TimeSlotList
              serviceId={serviceId}
              date={selectedDate}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
            />
          )}
        </div>
      )}

      {selectedSlot && (
        <div className="booking-confirm-card">
          <p>
            Confirmar <strong>{service?.name}</strong> em <strong>{fmtSlot(selectedSlot)}</strong>?
          </p>
          <button type="button" onClick={handleConfirm} disabled={createAgendamento.isPending}>
            {createAgendamento.isPending ? "Agendando…" : "Confirmar marcação"}
          </button>
        </div>
      )}
    </div>
  );
}
