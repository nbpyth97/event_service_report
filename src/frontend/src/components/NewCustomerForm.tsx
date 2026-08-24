import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Phone, User } from "lucide-react";
import type { Customer } from "@/api/client";
import { useCreateCustomer } from "@/hooks/queries";
import { formatPhoneDisplay, validatePhone } from "@/lib/format";
import { phonePlaceholderFor } from "@/lib/countryCodes";
import Button from "@/components/Button";
import CountryCodeSelect from "@/components/CountryCodeSelect";

interface NewCustomerFormValues {
  name: string;
  phone: string;
  country: string;
}

// Name + phone customer creation — reused by CustomerPicker's inline "novo
// cliente" quick-add (mid manual-appointment flow) and CustomersPage's
// standalone "Adicionar cliente" action. Both go through the same
// find-or-create-by-phone endpoint the public booking page also uses, so
// adding someone who already booked themselves resolves to that same
// Customer row instead of creating a duplicate.
//
// No readOnly-until-focus autofill-icon suppression here (there used to be
// one) — it could leave a field's *visible* DOM value out of sync with react-
// hook-form's tracked value whenever the browser filled the field itself
// (autofill, a saved-name suggestion) rather than the user typing character
// by character: RHF's uncontrolled fields only update their tracked value in
// response to a real onChange/input event, so a value the browser injected
// through its own non-standard autofill path could show on screen while RHF
// still believed the field was empty — required validation ("Indique o
// nome.") would then keep failing even though the input visibly had text in
// it. Suppressing the mobile autofill icon strip is a cosmetic nice-to-have;
// it's not worth a form staff genuinely cannot submit.
export default function NewCustomerForm({
  onCreated,
  onCancel,
}: {
  onCreated: (customer: Customer) => void;
  onCancel: () => void;
}) {
  const createCustomer = useCreateCustomer();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewCustomerFormValues>({ defaultValues: { name: "", phone: "", country: "PT" } });
  // useWatch, not the plain `watch()` method — `watch()` re-renders this
  // whole component on every change to ANY field in the form (not just
  // "country"), including every keystroke in name/phone; useWatch scopes the
  // subscription to just the field named here.
  const country = useWatch({ control, name: "country" });
  const phonePlaceholder = phonePlaceholderFor(country);

  const onSubmit = (values: NewCustomerFormValues) => {
    setError(null);
    createCustomer.mutate(
      { customer_known_name: values.name.trim(), phone: values.phone.trim(), country: values.country },
      {
        onSuccess: (customer) => {
          onCreated(customer);
          reset();
        },
        onError: (err) => setError(err instanceof Error ? err.message : "Não foi possível adicionar o cliente."),
      }
    );
  };

  return (
    <form className="customer-picker-add-form" onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="new-password">
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
              placeholder="Nome"
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
                placeholder={phonePlaceholder}
                type="text"
                inputMode="tel"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore
                maxLength={20}
                aria-invalid={Boolean(errors.phone)}
                ref={field.ref}
                value={field.value}
                onBlur={field.onBlur}
                onChange={(e) => field.onChange(formatPhoneDisplay(e.target.value))}
                name="cf-ph"
              />
            )}
          />
        </div>
      </div>
      {errors.phone && <p className="form-error" role="alert">{errors.phone.message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="customer-picker-add-actions">
        <Button variant="cancel" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={createCustomer.isPending}>
          {createCustomer.isPending ? "A adicionar…" : "Adicionar cliente"}
        </Button>
      </div>
    </form>
  );
}
