import { Link } from "react-router-dom";
import type { Service } from "@/api/client";

function fmtPrice(price: string): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Number(price));
}

export default function ServiceGrid({ services }: { services: Service[] }) {
  if (services.length === 0) {
    return (
      <div className="empty-state">
        <p>Ainda não há serviços disponíveis para marcação.</p>
        <p>Volte mais tarde ou contacte o salão diretamente.</p>
      </div>
    );
  }

  return (
    <div className="service-grid">
      {services.map((service) => (
        <Link key={service.id} to={`/book/${service.id}`} className="service-grid-card">
          <span className="service-grid-name">{service.name}</span>
          <span className="service-grid-meta">
            {service.duration_min} min · {fmtPrice(service.price)}
          </span>
        </Link>
      ))}
    </div>
  );
}
