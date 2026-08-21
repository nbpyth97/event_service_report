import { useState } from "react";
import { Plus } from "lucide-react";
import CustomerRow from "@/components/CustomerRow";
import NewCustomerForm from "@/components/NewCustomerForm";
import SearchFilterInput from "@/components/SearchFilterInput";
import { useAgendamentos, useCustomers } from "@/hooks/queries";

// Admin's customer directory — browse/search everyone who has ever booked
// (public anonymous page or a manual appointment), independent of any
// specific booking. Name/phone editing lives here too, not just contextually
// on an appointment, since an admin may want to correct a customer (e.g. a
// mistyped phone) before their next visit rather than in the middle of
// confirming a booking.
export default function CustomersPage() {
  const { data: customers, isLoading } = useCustomers();
  const { data: agendamentos } = useAgendamentos();
  const [query, setQuery] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);

  const bookingCounts = new Map<string, number>();
  for (const a of agendamentos ?? []) {
    bookingCounts.set(a.customer_id, (bookingCounts.get(a.customer_id) ?? 0) + 1);
  }

  const needle = query.trim().toLowerCase();
  const filtered = (customers ?? [])
    .filter(
      (c) =>
        !needle ||
        c.customer_known_name.toLowerCase().includes(needle) ||
        c.phone.toLowerCase().includes(needle)
    )
    .sort((a, b) => a.customer_known_name.localeCompare(b.customer_known_name, "pt-PT"));

  return (
    <div className="page">
      <div className="page-header-row">
        <h1>Clientes</h1>
        {!addingCustomer && (
          <button type="button" className="agendamentos-new-link customers-page-add-btn" onClick={() => setAddingCustomer(true)}>
            <Plus size={15} aria-hidden="true" />
            Adicionar cliente
          </button>
        )}
      </div>

      {addingCustomer && (
        <NewCustomerForm onCreated={() => setAddingCustomer(false)} onCancel={() => setAddingCustomer(false)} />
      )}

      <SearchFilterInput
        value={query}
        onChange={setQuery}
        placeholder="Procurar por nome ou telemóvel"
        ariaLabel="Procurar clientes"
      />

      {isLoading && <p className="muted">A carregar…</p>}

      {!isLoading && filtered.length === 0 && (
        <div className="empty-state">
          <p>{needle ? "Nenhum cliente encontrado." : "Ainda não há clientes registados."}</p>
          {!needle && <p>Os clientes aparecem aqui assim que fazem a primeira marcação.</p>}
        </div>
      )}

      {filtered.length > 0 && (
        <ul className="customers-page-list">
          {filtered.map((c) => (
            <CustomerRow key={c.id} customer={c} bookingCount={bookingCounts.get(c.id) ?? 0} />
          ))}
        </ul>
      )}
    </div>
  );
}
