import type { Service } from "@/api/client";
import { useCurrentUser } from "@/auth/user";
import { useDeleteService } from "@/hooks/queries";

export default function ServiceList({ services }: { services: Service[] }) {
  const { user } = useCurrentUser();
  const deleteService = useDeleteService();
  const isAdmin = user?.role === "admin";

  if (services.length === 0) return <p>Nenhum serviço cadastrado.</p>;

  return (
    <ul className="service-list">
      {services.map((service) => (
        <li key={service.id} className="service-list-item">
          <span className="service-name">{service.name}</span>
          <span className="service-price">R$ {service.price}</span>
          <span className="service-duration">{service.duration_min} min</span>
          {isAdmin && (
            <button
              type="button"
              onClick={() => deleteService.mutate(service.id)}
              disabled={deleteService.isPending}
            >
              Remover
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
