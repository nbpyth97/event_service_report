import { useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, CalendarPlus, Check, Pencil, X } from "lucide-react";
import type { Customer } from "@/api/client";
import { useUpdateCustomer } from "@/hooks/queries";
import { fmtPhoneLocalPT, formatPhonePT, validatePhoneDigits } from "@/lib/format";

// One row of CustomersPage's directory. Editing swaps the name and phone
// text for inputs right where they already sit (not a floating panel
// elsewhere on the row) and moves the trigger next to the phone — phone
// corrections are the common case (a customer mistyping their number), so
// that's the field the edit affordance should sit beside. Phone validation
// mirrors the booking forms exactly (same formatPhonePT / validatePhoneDigits)
// since it's the same identity key on the backend.
export default function CustomerRow({ customer, bookingCount }: { customer: Customer; bookingCount: number }) {
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(customer.customer_known_name);
  const [phoneValue, setPhoneValue] = useState(() => formatPhonePT(customer.phone));
  const [error, setError] = useState<string | null>(null);
  const updateCustomer = useUpdateCustomer();

  const displayName = customer.customer_known_name;

  const startEditing = () => {
    setNameValue(customer.customer_known_name);
    setPhoneValue(formatPhonePT(customer.phone));
    setError(null);
    setEditing(true);
  };

  const save = () => {
    const trimmedName = nameValue.trim();
    if (!trimmedName) return;
    const phoneCheck = validatePhoneDigits(phoneValue);
    if (phoneCheck !== true) {
      setError(phoneCheck);
      return;
    }
    updateCustomer.mutate(
      { id: customer.id, customer_known_name: trimmedName, phone: phoneValue },
      {
        onSuccess: () => setEditing(false),
        onError: (err) => setError(err instanceof Error ? err.message : "Não foi possível guardar."),
      }
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") setEditing(false);
  };

  return (
    <li className="customers-page-row">
      <div className="customers-page-row-identity">
        {editing ? (
          <input
            className="name-editor-input"
            value={nameValue}
            placeholder="Nome do cliente"
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={onKeyDown}
          />
        ) : (
          <span className="customers-page-row-name">{displayName}</span>
        )}
      </div>

      <div className="customers-page-row-phone-field">
        {editing ? (
          <input
            className="name-editor-input"
            value={phoneValue}
            type="tel"
            inputMode="tel"
            maxLength={16}
            autoFocus
            placeholder="351 912 345 678"
            aria-invalid={Boolean(error)}
            onChange={(e) => {
              setPhoneValue(formatPhonePT(e.target.value));
              setError(null);
            }}
            onKeyDown={onKeyDown}
          />
        ) : (
          <span className="customers-page-row-phone">{fmtPhoneLocalPT(customer.phone)}</span>
        )}
        {!editing && (
          <button
            type="button"
            className="name-editor-trigger"
            onClick={startEditing}
            aria-label="Editar cliente"
            title="Editar cliente"
          >
            <Pencil size={12} aria-hidden="true" />
          </button>
        )}
      </div>

      {editing ? (
        <span className="customers-page-row-edit-actions">
          <button
            type="button"
            className="name-editor-btn"
            onClick={save}
            disabled={updateCustomer.isPending}
            aria-label="Guardar cliente"
          >
            <Check size={13} aria-hidden="true" />
          </button>
          <button type="button" className="name-editor-btn" onClick={() => setEditing(false)} aria-label="Cancelar">
            <X size={13} aria-hidden="true" />
          </button>
        </span>
      ) : (
        <>
          {bookingCount > 0 ? (
            <Link
              to={`/agendamentos?person=${encodeURIComponent(displayName)}`}
              className="customers-page-row-count customers-page-row-count-link"
              title={`Ver marcações de ${displayName}`}
            >
              <CalendarCheck size={13} aria-hidden="true" />
              {bookingCount} marcaç{bookingCount === 1 ? "ão" : "ões"}
            </Link>
          ) : (
            <span className="customers-page-row-count">Sem marcações</span>
          )}
          <Link
            to={`/servicos?book=1&customerId=${customer.id}`}
            className="customers-page-row-new-appt"
            aria-label={`Nova marcação para ${displayName}`}
            title={`Nova marcação para ${displayName}`}
          >
            <CalendarPlus size={15} aria-hidden="true" />
          </Link>
        </>
      )}

      {error && (
        <span className="form-error customers-page-row-error" role="alert">
          {error}
        </span>
      )}
    </li>
  );
}
