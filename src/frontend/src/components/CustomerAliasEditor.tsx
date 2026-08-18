import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { useSetCustomerAlias } from "@/hooks/queries";

// Small inline editor for the admin-only "alias" — how this business knows a
// customer, independent of the name the customer books under (see
// new_backlog.md's "Appointments" item). Editing lives only on CustomersPage
// now — agendamento views show the alias read-only, to keep one place for
// this edit instead of repeating the affordance on every appointment row.
export default function CustomerAliasEditor({
  customerId,
  alias,
}: {
  customerId: string;
  alias: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(alias ?? "");
  const setAlias = useSetCustomerAlias();

  if (!editing) {
    return (
      <button
        type="button"
        className="alias-editor-trigger"
        onClick={() => {
          setValue(alias ?? "");
          setEditing(true);
        }}
        aria-label={alias ? "Editar apelido" : "Adicionar apelido"}
        title={alias ? "Editar apelido" : "Adicionar apelido"}
      >
        <Pencil size={12} aria-hidden="true" />
      </button>
    );
  }

  const save = () => {
    const trimmed = value.trim();
    setAlias.mutate({ id: customerId, alias: trimmed || null }, { onSuccess: () => setEditing(false) });
  };

  return (
    <span className="alias-editor">
      <input
        className="alias-editor-input"
        value={value}
        autoFocus
        placeholder="Como conhece este cliente?"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        type="button"
        className="alias-editor-btn"
        onClick={save}
        disabled={setAlias.isPending}
        aria-label="Guardar apelido"
      >
        <Check size={13} aria-hidden="true" />
      </button>
      <button type="button" className="alias-editor-btn" onClick={() => setEditing(false)} aria-label="Cancelar">
        <X size={13} aria-hidden="true" />
      </button>
    </span>
  );
}
