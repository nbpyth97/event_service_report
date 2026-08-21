import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Customer } from "@/api/client";
import ServiceBookingFlow from "@/components/booking/ServiceBookingFlow";
import CustomerPicker from "@/components/CustomerPicker";
import Button from "@/components/Button";
import { useAvailability, useCreateAgendamento, useCustomers, useMyCompany, useServices } from "@/hooks/queries";
import { useToast } from "@/lib/toast";
import { fmtSlot, weekdayPreposition } from "@/lib/date";

// Staff booking on a customer's behalf — the mirror of
// pages/public/PublicBookingPage.tsx, sharing ServiceBookingFlow for the
// day/slot half. What differs is the identity step: a CustomerPicker over the
// tenant's existing customers instead of a name+phone form.
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

  const { data: availability, isLoading: slotsLoading } = useAvailability(serviceId ?? "", selectedDate);

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
  const backHref = `/servicos?book=1${customerId ? `&customerId=${customerId}` : ""}`;

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
          showSuccess(`Marcação de ${customer.customer_known_name} enviada — aguarde a confirmação.`);
          navigate("/agendamentos");
        },
      }
    );
  };

  if (!service || !company) return <div className="page"><p>Carregando…</p></div>;

  return (
    <div className="page">
      <ServiceBookingFlow
        service={service}
        businessHours={company.settings.business_hours}
        back={<Link to={backHref} className="public-back-pill">&larr; Todos os serviços</Link>}
        identity={<CustomerPicker value={customer} onChange={setCustomer} />}
        canPickTime={Boolean(customer)}
        selectedDate={selectedDate}
        onSelectDate={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
        slots={availability?.slots ?? []}
        slotsLoading={slotsLoading}
        selectedSlot={selectedSlot}
        onSelectSlot={setSelectedSlot}
      >
        {selectedSlot && customer && (
          <div className="booking-confirm-card">
            <p>
              Marcar <strong>{service.name}</strong> para <strong>{customer.customer_known_name}</strong>{" "}
              {weekdayPreposition(selectedSlot)} <strong>{fmtSlot(selectedSlot)}</strong>?
            </p>
            <Button onClick={handleConfirm} disabled={createAgendamento.isPending}>
              {createAgendamento.isPending ? "Agendando…" : "Confirmar marcação"}
            </Button>
          </div>
        )}
      </ServiceBookingFlow>
    </div>
  );
}
