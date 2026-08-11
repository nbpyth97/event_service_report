import { useState, type FormEvent } from "react";
import type { Service } from "@/api/client";
import { useCreateAgendamento } from "@/hooks/queries";

export default function AgendamentoForm({ services }: { services: Service[] }) {
  const [serviceId, setServiceId] = useState("");
  const [startTime, setStartTime] = useState("");
  const createAgendamento = useCreateAgendamento();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createAgendamento.mutate(
      { service_id: serviceId, start_time: new Date(startTime).toISOString() },
      { onSuccess: () => { setServiceId(""); setStartTime(""); } }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="agendamento-form">
      <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
        <option value="" disabled>
          Escolha um serviço
        </option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name} ({service.duration_min} min)
          </option>
        ))}
      </select>
      <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
      <button type="submit" disabled={createAgendamento.isPending}>
        {createAgendamento.isPending ? "Agendando…" : "Agendar"}
      </button>
    </form>
  );
}
