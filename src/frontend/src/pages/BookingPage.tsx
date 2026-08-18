import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Customer } from "@/api/client";
import CalendarGrid from "@/components/CalendarGrid";
import CustomerPicker from "@/components/CustomerPicker";
import TimeSlotList from "@/components/TimeSlotList";
import { useCreateAgendamento, useCustomers, useMyCompany, useServices } from "@/hooks/queries";
import { useToast } from "@/lib/toast";
import { fmtPrice } from "@/lib/format";

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
  const [searchParams] = useSearchParams();
  const { data: services } = useServices();
  const { data: company } = useMyCompany();
  const { data: customers } = useCustomers();
  const createAgendamento = useCreateAgendamento();
  const { showSuccess } = useToast();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Arrived from CustomersPage's per-row "nova marcação" (or any link that
  // already knows the customer) — pre-select them once the list loads, so
  // CustomerPicker opens straight into its "selected" state instead of
  // making the admin search for the same person again. Only runs once: if
  // the admin then hits "Trocar", their choice should stick even though
  // customerId is still sitting in the URL.
  const customerId = searchParams.get("customerId");
  useEffect(() => {
    if (!customerId || customer) return;
    const match = customers?.find((c) => c.id === customerId);
    if (match) setCustomer(match);
  }, [customerId, customers]);

  const service = services?.find((s) => s.id === serviceId);
  const backHref = `/services?book=1${customerId ? `&customerId=${customerId}` : ""}`;

  if (services && !service) {
    return (
      <div className="page">
        <p>Serviço não encontrado. <Link to={backHref}>Voltar</Link></p>
      </div>
    );
  }

  const handleConfirm = () => {
    if (!serviceId || !selectedSlot || !customer) return;
    createAgendamento.mutate(
      { service_id: serviceId, start_time: selectedSlot, customer_id: customer.id },
      {
        onSuccess: () => {
          showSuccess(`Marcação de ${customer.alias ?? customer.name} enviada — aguarde a confirmação.`);
          navigate("/agendamentos");
        },
      }
    );
  };

  return (
    <div className="page">
      <div className="public-booking-topbar">
        <Link to={backHref} className="public-back-pill">&larr; Todos os serviços</Link>
      </div>
      {service && (
        <header className="booking-header">
          <h1>{service.name}</h1>
          <p className="sub">{service.duration_min} min · {fmtPrice(service.price)}</p>
        </header>
      )}

      <CustomerPicker value={customer} onChange={setCustomer} />

      {company && customer && (
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

      {selectedSlot && customer && (
        <div className="booking-confirm-card">
          <p>
            Marcar <strong>{service?.name}</strong> para <strong>{customer.alias ?? customer.name}</strong> em{" "}
            <strong>{fmtSlot(selectedSlot)}</strong>?
          </p>
          <button type="button" onClick={handleConfirm} disabled={createAgendamento.isPending}>
            {createAgendamento.isPending ? "Agendando…" : "Confirmar marcação"}
          </button>
        </div>
      )}
    </div>
  );
}
