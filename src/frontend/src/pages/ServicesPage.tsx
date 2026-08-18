import { useNavigate, useSearchParams } from "react-router-dom";
import ServiceForm from "@/components/ServiceForm";
import ServiceSelectList from "@/components/ServiceSelectList";
import ServiceList from "@/components/ServiceList";
import { useCurrentUser } from "@/auth/user";
import { useServices } from "@/hooks/queries";

export default function ServicesPage() {
  const { user } = useCurrentUser();
  const { data: services, isLoading } = useServices();
  const isAdmin = user?.role === "admin";
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Admins normally see the CRUD list here — ?book=1 (set by the "Nova
  // marcação" entry points on AgendamentosPage/CustomersPage) switches to
  // the same clickable, searchable service list a customer picks from, so
  // admins can reach the manual-appointment flow (CustomerPicker ->
  // calendar) that otherwise has no entry point in their normal Services
  // view.
  const picking = !isAdmin || searchParams.get("book") === "1";
  const customerId = searchParams.get("customerId") ?? undefined;

  return (
    <div className="page">
      {isAdmin && !picking && <ServiceForm />}
      {isLoading ? (
        <p>Carregando…</p>
      ) : picking ? (
        // Admin's own service list includes inactive ones (for CRUD) — the
        // booking picker must not offer those, same as a non-admin ever sees.
        <ServiceSelectList
          services={(services ?? []).filter((s) => s.active)}
          onSelect={(s) => navigate(`/book/${s.id}${customerId ? `?customerId=${customerId}` : ""}`)}
        />
      ) : (
        <ServiceList services={services ?? []} />
      )}
    </div>
  );
}
