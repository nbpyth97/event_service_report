import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { Phone, User } from "lucide-react";
import CalendarGrid from "@/components/CalendarGrid";
import PublicTimeSlotList from "@/components/PublicTimeSlotList";
import ServiceSelectList from "@/components/ServiceSelectList";
import { usePublicBook, usePublicCompany, usePublicServices } from "@/hooks/queries";
import { useToast } from "@/lib/toast";
import { fmtPrice, formatPhonePT, validatePhoneDigits } from "@/lib/format";

interface BookingFormValues {
  name: string;
  phone: string;
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

// The only unauthenticated booking path — no account, no password, just
// name + phone (see CLAUDE.md's Customer != User note and new_backlog.md's
// "User View" item). Reads the tenant from ?company=, the same query-param
// convention LoginPage.tsx already uses for its shareable login link.
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

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingFormValues>({ defaultValues: { name: "", phone: "" } });

  const service = services?.find((s) => s.id === serviceId);

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
      {!serviceId && (
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
        <>
          <header className="booking-header">
            <div className="public-booking-topbar">
              <p className="sub">{company.name}</p>
              <button
                type="button"
                className="public-back-pill"
                onClick={() => { setServiceId(null); setSelectedDate(null); setSelectedSlot(null); }}
              >
                &larr; Escolher outro serviço
              </button>
            </div>
            <h1>{service.name}</h1>
            <p className="sub">{service.duration_min} min · {fmtPrice(service.price)}</p>
          </header>

          <div className="booking-layout">
            <CalendarGrid
              businessHours={company.business_hours}
              selectedDate={selectedDate}
              onSelectDate={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
            />
            {selectedDate && (
              <PublicTimeSlotList
                slug={slug}
                serviceId={service.id}
                date={selectedDate}
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
              />
            )}
          </div>
        </>
      )}

      {selectedSlot && (
        <form className="booking-confirm-card" onSubmit={handleSubmit(onSubmit)} noValidate>
          <p>
            Marcar <strong>{service?.name}</strong> em <strong>{fmtSlot(selectedSlot)}</strong>
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
                    placeholder="+351 912 345 678"
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

          <button type="submit" disabled={publicBook.isPending}>
            {publicBook.isPending ? "A enviar…" : "Confirmar marcação"}
          </button>
        </form>
      )}
    </div>
  );
}
