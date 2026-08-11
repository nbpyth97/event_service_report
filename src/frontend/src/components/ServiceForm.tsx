import { useState, type FormEvent } from "react";
import { useCreateService } from "@/hooks/queries";

export default function ServiceForm() {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const createService = useCreateService();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createService.mutate(
      { name, price, duration_min: Number(durationMin) },
      { onSuccess: () => { setName(""); setPrice(""); setDurationMin(""); } }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="service-form">
      <input placeholder="Nome do serviço" value={name} onChange={(e) => setName(e.target.value)} required />
      <input
        placeholder="Preço"
        type="number"
        min="0"
        step="0.01"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        required
      />
      <input
        placeholder="Duração (min)"
        type="number"
        min="1"
        value={durationMin}
        onChange={(e) => setDurationMin(e.target.value)}
        required
      />
      <button type="submit" disabled={createService.isPending}>
        {createService.isPending ? "Salvando…" : "Adicionar serviço"}
      </button>
    </form>
  );
}
