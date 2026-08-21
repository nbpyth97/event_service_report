import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, CalendarPlus, ChevronRight, Pencil, Phone } from "lucide-react";
import type { Customer } from "@/api/client";
import { formatStoredPhone } from "@/lib/format";
import CustomerEditModal from "@/components/CustomerEditModal";

// One card of CustomersPage's directory. Stacked into three lines — name,
// phone, actions — rather than one crammed horizontal row: squeezing
// Name + Phone + Edit + Count + Action onto a single line is what forced
// long names ("Oselinda Francisca…") to truncate on narrow phones, and
// shrank every tap target in the process. Each line now gets the full card
// width, so the name never needs an ellipsis and the count/new-appointment
// controls stay comfortably tappable. The card itself stays static — editing
// opens CustomerEditModal as a bottom sheet rather than swapping the name/
// phone lines for inputs in place, which read as visual clutter (double
// blue outlines, tiny inline checkmarks) in a card this small.
export default function CustomerRow({ customer, bookingCount }: { customer: Customer; bookingCount: number }) {
  const [editing, setEditing] = useState(false);
  const displayName = customer.customer_known_name;

  return (
    <li className="customer-card">
      <div className="customer-card-top">
        <span className="customer-card-name">{displayName}</span>
        <button
          type="button"
          className="name-editor-trigger"
          onClick={() => setEditing(true)}
          aria-label="Editar cliente"
          title="Editar cliente"
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="customer-card-phone">
        <Phone size={13} aria-hidden="true" />
        <span>{formatStoredPhone(customer.phone)}</span>
      </div>

      <div className="customer-card-actions">
        {bookingCount > 0 ? (
          <Link
            to={`/agendamentos?person=${encodeURIComponent(displayName)}&personId=${customer.id}`}
            className="customer-card-count-badge customer-card-count-link"
            title={`Ver marcações de ${displayName}`}
          >
            <CalendarCheck size={14} aria-hidden="true" />
            {bookingCount} marcaç{bookingCount === 1 ? "ão" : "ões"}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          <span className="customer-card-count-badge">Sem marcações</span>
        )}
        <Link to={`/servicos?book=1&customerId=${customer.id}`} className="customer-card-new-appt-btn">
          <CalendarPlus size={15} aria-hidden="true" />
          Nova Marcação
        </Link>
      </div>

      {editing && <CustomerEditModal customer={customer} onClose={() => setEditing(false)} />}
    </li>
  );
}
