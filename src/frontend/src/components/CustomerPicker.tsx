import { useState } from "react";
import { Plus, UserCheck } from "lucide-react";
import type { Customer } from "@/api/client";
import { useCustomers } from "@/hooks/queries";
import SearchFilterInput from "@/components/SearchFilterInput";
import NewCustomerForm from "@/components/NewCustomerForm";

// Admin's manual-appointment customer picker: fetch-all + a plain frontend
// filter (per new_backlog.md's own stated simplification — no debounced
// server search), with a "novo cliente" quick-add (NewCustomerForm) for
// walk-ins who aren't in the list yet.
export default function CustomerPicker({
  value,
  onChange,
}: {
  value: Customer | null;
  onChange: (customer: Customer) => void;
}) {
  const { data: customers, isLoading } = useCustomers();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  if (value) {
    return (
      <div className="customer-picker-selected">
        <UserCheck size={16} aria-hidden="true" />
        <span className="customer-picker-selected-name">{value.customer_known_name}</span>
        <span className="customer-picker-selected-phone">{value.phone}</span>
        <button type="button" className="customer-picker-change" onClick={() => onChange(null as unknown as Customer)}>
          Trocar
        </button>
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const matches = (customers ?? []).filter((c) => {
    if (!needle) return true;
    return (
      c.customer_known_name.toLowerCase().includes(needle) ||
      c.phone.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="customer-picker">
      <SearchFilterInput
        value={query}
        onChange={setQuery}
        placeholder="Procurar cliente por nome ou telemóvel"
        ariaLabel="Procurar cliente"
      />

      {isLoading && <p className="customer-picker-hint">A carregar clientes…</p>}

      {!isLoading && matches.length > 0 && (
        <ul className="customer-picker-list">
          {matches.map((c) => (
            <li key={c.id}>
              <button type="button" className="customer-picker-row" onClick={() => onChange(c)}>
                <span className="customer-picker-row-name">{c.customer_known_name}</span>
                <span className="customer-picker-row-phone">{c.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && matches.length === 0 && !adding && (
        <p className="customer-picker-hint">Nenhum cliente encontrado.</p>
      )}

      {!adding && (
        <button type="button" className="customer-picker-add-toggle" onClick={() => setAdding(true)}>
          <Plus size={14} aria-hidden="true" />
          Novo cliente
        </button>
      )}

      {adding && (
        <NewCustomerForm
          onCreated={(customer) => {
            onChange(customer);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}
