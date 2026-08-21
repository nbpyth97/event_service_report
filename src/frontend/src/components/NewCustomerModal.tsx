import { useEffect, useRef } from "react";
import { useEvent } from "@/lib/useEvent";
import { X } from "lucide-react";
import type { Customer } from "@/api/client";
import NewCustomerForm from "@/components/NewCustomerForm";

// Same bottom-sheet shell as CustomerEditModal — rendering the create form
// inline in CustomersPage pushed the search bar and card list down and
// broke the page's flow every time it toggled open. NewCustomerForm itself
// is untouched (still the same name/phone fields + Cancelar/Adicionar
// actions); this just wraps it in the modal chrome instead of the page body,
// so it's still the same component CustomerPicker's inline quick-add uses.
export default function NewCustomerModal({
  onCreated,
  onClose,
}: {
  onCreated: (customer: Customer) => void;
  onClose: () => void;
}) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const handleClose = useEvent(onClose);

  useEffect(() => {
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-customer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-sheet-header">
          <h2 id="new-customer-title">Adicionar cliente</h2>
          <button type="button" ref={closeBtnRef} className="modal-close" onClick={onClose} aria-label="Fechar">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <NewCustomerForm onCreated={onCreated} onCancel={onClose} />
      </div>
    </div>
  );
}
