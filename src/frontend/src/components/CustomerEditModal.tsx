import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Phone, User, X } from "lucide-react";
import type { Customer } from "@/api/client";
import { useUpdateCustomer } from "@/hooks/queries";
import { formatPhoneDisplay, validatePhone } from "@/lib/format";
import { phonePlaceholderFor, splitE164 } from "@/lib/countryCodes";
import { useEvent } from "@/lib/useEvent";
import Button from "@/components/Button";
import CountryCodeSelect from "@/components/CountryCodeSelect";

interface EditFormValues {
  name: string;
  phone: string;
  country: string;
}

// Bottom sheet, not inline inputs squeezed into the card — a customer card
// only has room for two short lines, and cramming name/phone inputs plus
// save/cancel icons into that space read as visual clutter (double blue
// outlines, tiny checkmarks). One PUT saves both fields together (see
// hooks/queries.ts::useUpdateCustomer / routers/customers.py) — always send
// both, never split into two requests, since the backend has no separate
// name-only or phone-only endpoint.
export default function CustomerEditModal({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const updateCustomer = useUpdateCustomer();
  const [error, setError] = useState<string | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  // Preselect the picker to the customer's actual country (matched off the
  // stored dial code) and show only the national number in the phone field —
  // otherwise the dial code appeared twice: once in the picker ("Portugal
  // (+351)"), once again at the start of the phone input ("+351 911 ...").
  // Falls back to the old PT-default + full-"+"-prefixed-number behaviour
  // for a customer whose country isn't in COUNTRY_CODES, since there's then
  // no dial code to preselect or strip.
  const phoneSplit = splitE164(customer.phone);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EditFormValues>({
    defaultValues: {
      name: customer.customer_known_name,
      phone: phoneSplit ? formatPhoneDisplay(phoneSplit.national) : formatPhoneDisplay(customer.phone),
      country: phoneSplit?.iso2 ?? "PT",
    },
  });
  // useWatch, not the plain `watch()` method — `watch()` re-renders this
  // whole component on every change to ANY field in the form (not just
  // "country"), including every keystroke in name/phone; useWatch scopes the
  // subscription to just the field named here.
  const country = useWatch({ control, name: "country" });
  const phonePlaceholder = phonePlaceholderFor(country);
  const handleClose = useEvent(onClose);

  useEffect(() => {
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  const onSubmit = (values: EditFormValues) => {
    setError(null);
    updateCustomer.mutate(
      { id: customer.id, customer_known_name: values.name.trim(), phone: values.phone.trim(), country: values.country },
      {
        onSuccess: onClose,
        onError: (err) => setError(err instanceof Error ? err.message : "Não foi possível guardar."),
      }
    );
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-sheet-header">
          <h2 id="customer-edit-title">Editar cliente</h2>
          <button type="button" ref={closeBtnRef} className="modal-close" onClick={onClose} aria-label="Fechar">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form className="customer-edit-form" onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="new-password">
          <div className="auth-field">
            <label className="auth-label" htmlFor="customer-edit-name">Nome</label>
            <div className="service-form-input-wrap">
              <User size={16} aria-hidden="true" />
              <Controller
                name="name"
                control={control}
                rules={{
                  required: "Indique o nome.",
                  validate: (v) => v.trim().length > 0 || "Indique o nome.",
                }}
                render={({ field }) => (
                  <input
                    id="customer-edit-name"
                    placeholder="Nome do cliente"
                    autoFocus
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore
                    maxLength={150}
                    aria-invalid={Boolean(errors.name)}
                    ref={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(e) => field.onChange(e.target.value)}
                    name="cf-nm"
                  />
                )}
              />
            </div>
            {errors.name && <p className="form-error" role="alert">{errors.name.message}</p>}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="customer-edit-phone">Telemóvel</label>
            <div className="phone-field-row">
              <Controller
                name="country"
                control={control}
                render={({ field }) => <CountryCodeSelect value={field.value} onChange={field.onChange} />}
              />
              <div className="service-form-input-wrap">
                <Phone size={16} aria-hidden="true" />
                <Controller
                  name="phone"
                  control={control}
                  rules={{ required: "Indique o telemóvel.", validate: validatePhone }}
                  render={({ field }) => (
                    <input
                      id="customer-edit-phone"
                      placeholder={phonePlaceholder}
                      type="text"
                      inputMode="tel"
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore
                      maxLength={20}
                      aria-invalid={Boolean(errors.phone)}
                      name="cf-ph"
                      ref={field.ref}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={(e) => field.onChange(formatPhoneDisplay(e.target.value))}
                    />
                  )}
                />
              </div>
            </div>
            {errors.phone && <p className="form-error" role="alert">{errors.phone.message}</p>}
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <Button type="submit" disabled={updateCustomer.isPending}>
            {updateCustomer.isPending ? "A guardar…" : "Guardar alterações"}
          </Button>
        </form>
      </div>
    </div>
  );
}
