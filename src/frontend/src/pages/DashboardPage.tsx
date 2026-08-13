import { Link } from "react-router-dom";
import { Briefcase, CalendarCheck, CalendarDays, User, Wallet } from "lucide-react";
import { useAgendamentos, useServices } from "@/hooks/queries";
import { fmtDateTime, fmtPrice } from "@/lib/format";
import StatCard from "@/components/StatCard";
import StatusBreakdown from "@/components/StatusBreakdown";
import StatusChip from "@/components/StatusChip";

function isSameMonth(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

export default function DashboardPage() {
  const { data: services, isLoading: servicesLoading } = useServices();
  const { data: agendamentos, isLoading: agendamentosLoading } = useAgendamentos();

  const now = new Date();
  const activeServices = services?.filter((s) => s.active).length ?? 0;
  const pending = agendamentos?.filter((a) => a.status === "pending").length ?? 0;

  const confirmedThisMonth = agendamentos?.filter((a) => a.status === "confirmed" && isSameMonth(a.start_time, now)) ?? [];
  const revenueThisMonth = confirmedThisMonth.reduce((sum, a) => sum + Number(a.service_price), 0);

  const upcoming = (agendamentos ?? [])
    .filter((a) => (a.status === "pending" || a.status === "confirmed") && new Date(a.start_time) >= now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .slice(0, 5);

  return (
    <div className="page">
      <div className="ledger-header">
        <span className="ledger-header-date">
          {now.toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long" })}
        </span>
        {pending > 0 ? (
          <span className="ledger-header-status ledger-header-status-alert">
            {pending} aguardando aprovação
          </span>
        ) : (
          <span className="ledger-header-status">Tudo em dia</span>
        )}
      </div>

      <div className="dashboard-cards">
        <StatCard
          icon={Briefcase}
          value={servicesLoading ? "…" : (services?.length ?? 0)}
          label="Serviços"
          secondary={servicesLoading ? undefined : `${activeServices} ativos`}
          to="/services"
        />
        <StatCard
          icon={CalendarCheck}
          value={agendamentosLoading ? "…" : (agendamentos?.length ?? 0)}
          label="Agendamentos"
          secondary={agendamentosLoading ? undefined : `${pending} pendentes`}
          to="/agendamentos"
        />
        <StatCard
          icon={Wallet}
          value={agendamentosLoading ? "…" : fmtPrice(revenueThisMonth)}
          label="Receita este mês"
          secondary={agendamentosLoading ? undefined : `${confirmedThisMonth.length} confirmados`}
        />
      </div>

      <section className="dashboard-section">
        <h2>Distribuição de marcações</h2>
        <StatusBreakdown agendamentos={agendamentos ?? []} />
      </section>

      <section className="dashboard-section">
        <div className="page-header-row">
          <h2>Hoje e a seguir</h2>
          <Link to="/agendamentos" className="agendamentos-new-link">
            Ver todos
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="muted">Nada agendado para os próximos dias.</p>
        ) : (
          <ul className="upcoming-list">
            {upcoming.map((a) => (
              <li key={a.id} className="upcoming-item">
                <div className="upcoming-item-main">
                  <span className="upcoming-item-service">{a.service_name}</span>
                  <span className="upcoming-item-customer">
                    <User size={13} aria-hidden="true" />
                    {a.customer_name}
                  </span>
                </div>
                <div className="upcoming-item-meta">
                  <span className="upcoming-item-time">
                    <CalendarDays size={13} aria-hidden="true" />
                    {fmtDateTime(a.start_time)}
                  </span>
                  <StatusChip status={a.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
