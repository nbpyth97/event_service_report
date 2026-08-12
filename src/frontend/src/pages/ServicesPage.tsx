import ServiceForm from "@/components/ServiceForm";
import ServiceGrid from "@/components/ServiceGrid";
import ServiceList from "@/components/ServiceList";
import { useCurrentUser } from "@/auth/user";
import { useServices } from "@/hooks/queries";

export default function ServicesPage() {
  const { user } = useCurrentUser();
  const { data: services, isLoading } = useServices();
  const isAdmin = user?.role === "admin";

  return (
    <div className="page">
      <h1>Serviços</h1>
      {isAdmin && <ServiceForm />}
      {isLoading ? (
        <p>Carregando…</p>
      ) : isAdmin ? (
        <ServiceList services={services ?? []} />
      ) : (
        <ServiceGrid services={services ?? []} />
      )}
    </div>
  );
}
