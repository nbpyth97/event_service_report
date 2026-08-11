import ServiceForm from "@/components/ServiceForm";
import ServiceList from "@/components/ServiceList";
import { useCurrentUser } from "@/auth/user";
import { useServices } from "@/hooks/queries";

export default function ServicesPage() {
  const { user } = useCurrentUser();
  const { data: services, isLoading } = useServices();

  return (
    <div className="page">
      <h1>Serviços</h1>
      {user?.role === "admin" && <ServiceForm />}
      {isLoading ? <p>Carregando…</p> : <ServiceList services={services ?? []} />}
    </div>
  );
}
