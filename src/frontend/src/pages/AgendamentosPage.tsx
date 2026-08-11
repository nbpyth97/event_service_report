import AgendamentoForm from "@/components/AgendamentoForm";
import AgendamentoList from "@/components/AgendamentoList";
import { useAgendamentos, useServices } from "@/hooks/queries";

export default function AgendamentosPage() {
  const { data: services } = useServices();
  const { data: agendamentos, isLoading } = useAgendamentos();

  return (
    <div className="page">
      <h1>Agendamentos</h1>
      <AgendamentoForm services={services ?? []} />
      {isLoading ? <p>Carregando…</p> : <AgendamentoList agendamentos={agendamentos ?? []} />}
    </div>
  );
}
