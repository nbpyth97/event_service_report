import { Search } from "lucide-react";

// Admin-only customer-name search. Customer users never filter by person —
// they only ever see their own bookings — so this isn't rendered for them.
export default function AgendamentoSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="agendamento-filter-search">
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        placeholder="Filtrar por cliente…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filtrar por cliente"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
    </div>
  );
}
