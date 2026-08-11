import { Link } from 'react-router-dom';
import { listServices } from '../lib/services';
import { tenantConfig, tenantServices } from '../lib/tenant';

function fmtPrice(n) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function ServiceListPage() {
  const services = listServices(tenantServices);
  const women = services.filter((s) => s.gender === 'mulher');
  const men = services.filter((s) => s.gender === 'homem');

  return (
    <div className="page">
      <header className="header">
        <div className="eyebrow">{tenantConfig.location_label}</div>
        <h1>{tenantConfig.business_name}</h1>
        <p className="sub">Escolha um serviço para marcar o seu horário.</p>
      </header>

      {women.length > 0 && (
        <section>
          <h2 className="section-title">Mulher</h2>
          <div className="service-grid">
            {women.map((s) => (
              <Link key={s.slug} to={`/mulher/${s.slug}`} className="service-card">
                <div className="service-name">{s.name}</div>
                <div className="service-meta">{s.duration_min} min · {fmtPrice(s.price)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {men.length > 0 && (
        <section>
          <h2 className="section-title">Homem</h2>
          <div className="service-grid">
            {men.map((s) => (
              <Link key={s.slug} to={`/homem/${s.slug}`} className="service-card">
                <div className="service-name">{s.name}</div>
                <div className="service-meta">{s.duration_min} min · {fmtPrice(s.price)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
