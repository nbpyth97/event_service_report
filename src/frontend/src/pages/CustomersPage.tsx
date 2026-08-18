import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, CalendarPlus, Plus } from "lucide-react";
import CustomerAliasEditor from "@/components/CustomerAliasEditor";
import NewCustomerForm from "@/components/NewCustomerForm";
import SearchFilterInput from "@/components/SearchFilterInput";
import { useAgendamentos, useCustomers } from "@/hooks/queries";
import { fmtPhoneLocalPT } from "@/lib/format";

// Admin's customer directory — browse/search everyone who has ever booked
// (public anonymous page or a manual appointment), independent of any
// specific booking. Alias editing lives here too, not just contextually on
// an appointment, since an admin may want to label a regular before their
// next visit rather than in the middle of confirming a booking.
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
        c.name.toLowerCase().includes(needle) ||
        c.phone.toLowerCase().includes(needle) ||
        (c.alias?.toLowerCase().includes(needle) ?? false)
    )
    .sort((a, b) => (a.alias ?? a.name).localeCompare(b.alias ?? b.name, "pt-PT"));

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
        placeholder="Procurar por nome, apelido ou telemóvel"
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
          {filtered.map((c) => {
            const count = bookingCounts.get(c.id) ?? 0;
            const displayName = c.alias ?? c.name;
            return (
              <li key={c.id} className="customers-page-row">
                <div className="customers-page-row-identity">
                  <span className="customers-page-row-name">
                    {displayName}
                    {c.alias && <span className="appt-row-real-name"> ({c.name})</span>}
                  </span>
                  <CustomerAliasEditor customerId={c.id} alias={c.alias} />
                </div>
                <span className="customers-page-row-phone">{fmtPhoneLocalPT(c.phone)}</span>
                {count > 0 ? (
                  <Link
                    to={`/agendamentos?person=${encodeURIComponent(displayName)}`}
                    className="customers-page-row-count customers-page-row-count-link"
                    title={`Ver marcações de ${displayName}`}
                  >
                    <CalendarCheck size={13} aria-hidden="true" />
                    {count} marcaç{count === 1 ? "ão" : "ões"}
                  </Link>
                ) : (
                  <span className="customers-page-row-count">Sem marcações</span>
                )}
                <Link
                  to={`/services?book=1&customerId=${c.id}`}
                  className="customers-page-row-new-appt"
                  aria-label={`Nova marcação para ${displayName}`}
                  title={`Nova marcação para ${displayName}`}
                >
                  <CalendarPlus size={15} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
