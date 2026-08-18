import { useNavigate, useSearchParams } from "react-router-dom";
import ServiceForm from "@/components/ServiceForm";
import ServiceSelectList from "@/components/ServiceSelectList";
import ServiceList from "@/components/ServiceList";
import { useServices } from "@/hooks/queries";

export default function ServicesPage() {
  const { data: services, isLoading } = useServices();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Staff normally see the CRUD list here — ?book=1 (set by the "Nova
  // marcação" entry points on AgendamentosPage/CustomersPage) switches to
  // the same clickable, searchable service list a customer picks from, so
  // staff can reach the manual-appointment flow (CustomerPicker -> calendar)
  // that otherwise has no entry point in their normal Services view.
  const picking = searchParams.get("book") === "1";
  const customerId = searchParams.get("customerId") ?? undefined;

  return (
    <div className="page">
      {!picking && <ServiceForm />}
      {isLoading ? (
        <p>Carregando…</p>
      ) : picking ? (
        // The staff service list includes inactive ones (for CRUD) — the
        // booking picker must not offer those.
        <ServiceSelectList
          services={(services ?? []).filter((s) => s.active)}
          onSelect={(s) => navigate(`/servicos/${s.id}/marcar${customerId ? `?customerId=${customerId}` : ""}`)}
        />
      ) : (
        <ServiceList services={services ?? []} />
      )}
    </div>
  );
}
