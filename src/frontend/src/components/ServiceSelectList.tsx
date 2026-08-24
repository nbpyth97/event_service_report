import { useState } from "react";
import { ChevronRight, Clock } from "lucide-react";
import type { Service } from "@/api/client";
import SearchFilterInput from "@/components/SearchFilterInput";
import { fmtPrice } from "@/lib/format";

// Service-picking step, shared by the public anonymous booking page and the
// admin's manual-appointment flow (Nova marcação) — same card, same local
// name filter, so which flow you're in doesn't change how picking a service
// feels. onSelect rather than a Link/href: the public page swaps local
// state, the admin flow navigates — the caller decides which.
export default function ServiceSelectList({
  services,
  onSelect,
}: {
  services: Service[];
  onSelect: (service: Service) => void;
}) {
  const [query, setQuery] = useState("");

  if (services.length === 0) {
    return (
      <div className="empty-state">
        <p>Ainda não há serviços disponíveis para marcação.</p>
        <p>Volte mais tarde ou contacte a empresa diretamente.</p>
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const filtered = needle ? services.filter((s) => s.name.toLowerCase().includes(needle)) : services;

  return (
    <div className="service-select">
      <SearchFilterInput
        value={query}
        onChange={setQuery}
        placeholder="Procurar serviço…"
        ariaLabel="Procurar serviço"
      />

      {filtered.length === 0 ? (
        <p className="customer-picker-hint">Nenhum serviço encontrado.</p>
      ) : (
        <ul className="service-select-list">
          {filtered.map((s) => (
            <li key={s.id}>
              <button type="button" className="service-select-card" onClick={() => onSelect(s)}>
                <span className="service-select-card-info">
                  <span className="service-select-card-name">{s.name}</span>
                  <span className="service-select-card-duration">
                    <Clock size={12} aria-hidden="true" />
                    {s.duration_min} min
                  </span>
                </span>
                <span className="service-select-card-action">
                  <span className="service-select-card-price">{fmtPrice(s.price)}</span>
                  <span className="service-select-card-cta">
                    Selecionar
                    <ChevronRight size={14} aria-hidden="true" />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
