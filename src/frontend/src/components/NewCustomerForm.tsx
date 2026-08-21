import { Controller, useForm } from "react-hook-form";
import { Phone, User } from "lucide-react";
import type { Customer } from "@/api/client";
import { useCreateCustomer } from "@/hooks/queries";
import { formatPhonePT, validatePhoneDigits } from "@/lib/format";
import Button from "@/components/Button";

interface NewCustomerFormValues {
  name: string;
  phone: string;
}

// Name + phone customer creation — reused by CustomerPicker's inline "novo
// cliente" quick-add (mid manual-appointment flow) and CustomersPage's
// standalone "Adicionar cliente" action. Both go through the same
// find-or-create-by-phone endpoint the public booking page also uses, so
// adding someone who already booked themselves resolves to that same
// Customer row instead of creating a duplicate.
export default function NewCustomerForm({
  onCreated,
  onCancel,
}: {
  onCreated: (customer: Customer) => void;
  onCancel: () => void;
}) {
  const createCustomer = useCreateCustomer();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewCustomerFormValues>({ defaultValues: { name: "", phone: "" } });

  const onSubmit = (values: NewCustomerFormValues) => {
    createCustomer.mutate(
      { customer_known_name: values.name.trim(), phone: values.phone.trim() },
      {
        onSuccess: (customer) => {
          onCreated(customer);
          reset();
        },
      }
    );
  };

  return (
    <form className="customer-picker-add-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="service-form-input-wrap">
        <User size={16} aria-hidden="true" />
        <input
          placeholder="Nome"
          autoFocus
          maxLength={150}
          aria-invalid={Boolean(errors.name)}
          {...register("name", {
            required: "Indique o nome.",
            validate: (v) => v.trim().length > 0 || "Indique o nome.",
            setValueAs: (v: string) => v.trim(),
          })}
        />
      </div>
      {errors.name && <p className="form-error" role="alert">{errors.name.message}</p>}

      <div className="service-form-input-wrap">
        <Phone size={16} aria-hidden="true" />
        <Controller
          name="phone"
          control={control}
          rules={{ required: "Indique o telemóvel.", validate: validatePhoneDigits }}
          render={({ field }) => (
            <input
              placeholder="351 912 345 678"
              type="tel"
              inputMode="tel"
              maxLength={16}
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
