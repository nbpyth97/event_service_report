import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Phone, User, X } from "lucide-react";
import type { Customer } from "@/api/client";
import { useUpdateCustomer } from "@/hooks/queries";
import { formatPhonePT, validatePhoneDigits } from "@/lib/format";
import Button from "@/components/Button";

interface EditFormValues {
  name: string;
  phone: string;
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
  // Neither autocomplete="off" nor "new-password" alone stops Chrome/
  // Android's autofill accessory strip (passkey/payment/address icons) on
  // these fields — the browser decides at its initial DOM scan, before any
  // attribute-based opt-out is read as authoritative. Loading each field
  // readOnly and only lifting that on focus is the remaining lever: autofill
  // only attaches to fields it sees as editable during that scan.
  const [nameLocked, setNameLocked] = useState(true);
  const [phoneLocked, setPhoneLocked] = useState(true);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditFormValues>({
    defaultValues: { name: customer.customer_known_name, phone: formatPhonePT(customer.phone) },
  });

  useEffect(() => {
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const onSubmit = (values: EditFormValues) => {
    setError(null);
    updateCustomer.mutate(
      { id: customer.id, customer_known_name: values.name.trim(), phone: values.phone.trim() },
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
              <input
                id="customer-edit-name"
                placeholder="Nome do cliente"
                autoFocus
                readOnly={nameLocked}
                onFocus={() => setNameLocked(false)}
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore
                maxLength={150}
                aria-invalid={Boolean(errors.name)}
                {...register("name", {
                  required: "Indique o nome.",
                  validate: (v) => v.trim().length > 0 || "Indique o nome.",
                })}
                name="cf-nm"
              />
            </div>
            {errors.name && <p className="form-error" role="alert">{errors.name.message}</p>}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="customer-edit-phone">Telemóvel</label>
            <div className="service-form-input-wrap">
              <Phone size={16} aria-hidden="true" />
              <Controller
                name="phone"
                control={control}
                rules={{ required: "Indique o telemóvel.", validate: validatePhoneDigits }}
                render={({ field }) => (
                  <input
                    id="customer-edit-phone"
                    placeholder="351 912 345 678"
                    type="text"
                    inputMode="tel"
                    readOnly={phoneLocked}
                    onFocus={() => setPhoneLocked(false)}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore
                    maxLength={16}
                    aria-invalid={Boolean(errors.phone)}
                    name="cf-ph"
                    ref={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(e) => field.onChange(formatPhonePT(e.target.value))}
                  />
                )}
              />
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
