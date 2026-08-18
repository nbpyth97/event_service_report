import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

const DEBOUNCE_MS = 100;

// Reusable local (client-side) filter search — debounces onChange so fast
// typing doesn't re-filter a list on every keystroke, and always renders its
// own clear button rather than relying on a native type="search" clear icon
// (which is why AgendamentosPage's search had a clear affordance and
// CustomersPage's otherwise-identical-looking one didn't: only one of them
// used type="search", and browser support for that icon isn't universal
// anyway). The input itself stays uncontrolled-feeling — it always reflects
// what was typed immediately; only the debounced `onChange` call lags.
export default function SearchFilterInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stay in sync when the parent resets the filter from outside (e.g. a
  // deep link seeding the query, or a page-level "clear filters" action).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleChange = (next: string) => {
    setDraft(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(next), DEBOUNCE_MS);
  };

  const clear = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setDraft("");
    onChange("");
  };

  return (
    <div className="search-filter-input">
      <Search size={16} aria-hidden="true" />
      <input
        type="text"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        aria-label={ariaLabel}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {draft && (
        <button type="button" className="search-filter-input-clear" onClick={clear} aria-label="Limpar filtro">
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
