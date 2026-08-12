import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import AgendamentoList from "@/components/AgendamentoList";
import DayTimeline from "@/components/DayTimeline";
import { useCurrentUser } from "@/auth/user";
import { useAgendamentos, useMyCompany } from "@/hooks/queries";

export default function AgendamentosPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const { data: agendamentos, isLoading } = useAgendamentos();
  const { data: company } = useMyCompany();
  const pendingCount = agendamentos?.filter((a) => a.status === "pending").length ?? 0;

  return (
    <div className="page">
      <div className="page-header-row">
        <h1>Agendamentos</h1>
        {isAdmin && pendingCount > 0 && (
          <span className="pending-badge">
            <Clock size={14} aria-hidden="true" />
            {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
          </span>
        )}
        {!isAdmin && (
          <Link to="/services" className="agendamentos-new-link">
            + Nova marcação
          </Link>
        )}
      </div>

      {isAdmin && company && <DayTimeline businessHours={company.settings.business_hours} agendamentos={agendamentos ?? []} />}

      {isLoading ? <p>Carregando…</p> : <AgendamentoList agendamentos={agendamentos ?? []} />}
    </div>
  );
}
