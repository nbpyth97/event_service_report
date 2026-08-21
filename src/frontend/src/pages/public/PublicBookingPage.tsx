import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { Phone, User } from "lucide-react";
import ServiceBookingFlow from "@/components/booking/ServiceBookingFlow";
import ServiceSelectList from "@/components/ServiceSelectList";
import { usePublicAvailability, usePublicBook, usePublicCompany, usePublicServices } from "@/hooks/queries";
import { useToast } from "@/lib/toast";
import { fmtSlot } from "@/lib/date";
import { setDisplayTimeZone } from "@/lib/tz";
import { formatPhonePT, validatePhoneDigits } from "@/lib/format";
import Button from "@/components/Button";

interface BookingFormValues {
  name: string;
  phone: string;
}

// The only unauthenticated booking path — no account, no password, just
// name + phone (see CLAUDE.md's Customer != User note and new_backlog.md's
// "User View" item). Reads the tenant from ?company=, the same query-param
// convention LoginPage.tsx already uses for its shareable login link. The
// day/slot picking itself is ServiceBookingFlow, shared with the staff
// BookingPage — only the identity step below differs.
export default function PublicBookingPage() {
  const [searchParams] = useSearchParams();
  const slug = searchParams.get("company") ?? "";
  const { data: company, isLoading: companyLoading, isError: companyError } = usePublicCompany(slug);
  const { data: services } = usePublicServices(slug);
  const publicBook = usePublicBook();
  const { showSuccess } = useToast();

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Slot buttons must read in the salon's local time, not the visitor's — see
  // lib/tz.ts. AppShell does the same for the staff surface, which this page
  // deliberately sits outside of.
  setDisplayTimeZone(company?.timezone);

  const service = services?.find((s) => s.id === serviceId) ?? null;
  const { data: availability, isLoading: slotsLoading } = usePublicAvailability(
    slug,
    service?.id ?? "",
    selectedDate
  );

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingFormValues>({ defaultValues: { name: "", phone: "" } });

  if (!slug) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1 className="auth-title">Link incompleto</h1>
          <p className="auth-subtitle">Este link de marcação não indica a empresa. Peça ao salão o link correto.</p>
        </div>
      </div>
    );
  }

  if (companyError) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1 className="auth-title">Empresa não encontrada</h1>
          <p className="auth-subtitle">Verifique o link com o salão — pode estar incorreto.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1 className="auth-title">Marcação enviada!</h1>
          <p className="auth-subtitle">{company?.name} vai confirmar a sua marcação em breve.</p>
        </div>
      </div>
    );
  }

  const onSubmit = (values: BookingFormValues) => {
    if (!serviceId || !selectedSlot) return;
    publicBook.mutate(
      {
        slug,
        payload: {
          service_id: serviceId,
          start_time: selectedSlot,
          name: values.name.trim(),
          phone: values.phone.trim(),
        },
      },
      { onSuccess: () => { showSuccess("Marcação enviada!"); setDone(true); } }
    );
  };

  return (
    <div className="page">
      {!service && (
        <>
          <header className="public-hero">
            <div className="auth-eyebrow">
              <span className="auth-status-dot" aria-hidden="true" />
              MARCAR HORÁRIO
            </div>
            <h1 className="public-hero-title">{companyLoading ? "…" : company?.name}</h1>
            <p className="public-hero-subtitle">Escolha um serviço para ver os horários disponíveis.</p>
          </header>

          {services && <ServiceSelectList services={services} onSelect={(s) => setServiceId(s.id)} />}
        </>
      )}

      {service && company && (
        <ServiceBookingFlow
          service={service}
          businessHours={company.business_hours}
          eyebrow={<p className="sub">{company.name}</p>}
          back={
            <button
              type="button"
              className="public-back-pill"
              onClick={() => { setServiceId(null); setSelectedDate(null); setSelectedSlot(null); }}
            >
              &larr; Escolher outro serviço
            </button>
          }
          selectedDate={selectedDate}
          onSelectDate={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
          slots={availability?.slots ?? []}
          slotsLoading={slotsLoading}
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
        >
          {selectedSlot && (
            <form className="booking-confirm-card" onSubmit={handleSubmit(onSubmit)} noValidate>
              <p>
                Marcar <strong>{service.name}</strong> em <strong>{fmtSlot(selectedSlot)}</strong>
              </p>

              <div className="auth-field">
                <label className="auth-label" htmlFor="public-booking-name">Seu nome</label>
                <div className="service-form-input-wrap">
                  <User size={16} aria-hidden="true" />
                  <input
                    id="public-booking-name"
                    placeholder="Nome"
                    autoComplete="name"
                    maxLength={150}
                    aria-invalid={Boolean(errors.name)}
                    {...register("name", {
                      required: "Indique o seu nome.",
                      validate: (v) => v.trim().length > 0 || "Indique o seu nome.",
                      setValueAs: (v: string) => v.trim(),
                    })}
                  />
                </div>
                {errors.name && <p className="form-error" role="alert">{errors.name.message}</p>}
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="public-booking-phone">Telemóvel</label>
                <div className="service-form-input-wrap">
                  <Phone size={16} aria-hidden="true" />
                  <Controller
                    name="phone"
                    control={control}
                    rules={{ required: "Indique o seu telemóvel.", validate: validatePhoneDigits }}
                    render={({ field }) => (
                      <input
                        id="public-booking-phone"
                        placeholder="351 912 345 678"
                        type="tel"
                        inputMode="tel"
                        maxLength={16}
                        autoComplete="tel"
                        aria-invalid={Boolean(errors.phone)}
                        name={field.name}
                        ref={field.ref}
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={(e) => field.onChange(formatPhonePT(e.target.value))}
                      />
                    )}
                  />
                </div>
                {errors.phone && <p className="form-error" role="alert">{errors.phone.message}</p>}
                <p className="auth-field-hint">Usado pelo salão para confirmar a sua marcação.</p>
              </div>

              <Button type="submit" disabled={publicBook.isPending}>
                {publicBook.isPending ? "A enviar…" : "Confirmar marcação"}
              </Button>
            </form>
          )}
        </ServiceBookingFlow>
      )}
    </div>
  );
}
