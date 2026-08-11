import { useAgendamentos, useServices } from "@/hooks/queries";

export default function DashboardPage() {
  const { data: services } = useServices();
  const { data: agendamentos } = useAgendamentos();
  const pending = agendamentos?.filter((a) => a.status === "pending").length ?? 0;

  return (
    <div className="page">
      <h1>Painel</h1>
      <div className="dashboard-cards">
        <div className="dashboard-card">
          <span className="dashboard-card-value">{services?.length ?? 0}</span>
          <span className="dashboard-card-label">Serviços</span>
        </div>
        <div className="dashboard-card">
          <span className="dashboard-card-value">{agendamentos?.length ?? 0}</span>
          <span className="dashboard-card-label">Agendamentos</span>
        </div>
        <div className="dashboard-card">
          <span className="dashboard-card-value">{pending}</span>
          <span className="dashboard-card-label">Pendentes</span>
        </div>
      </div>
    </div>
  );
}
