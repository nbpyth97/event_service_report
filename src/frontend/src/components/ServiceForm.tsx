import { useState, type FormEvent } from "react";
import { Clock, Euro, Plus, Tag } from "lucide-react";
import { useCreateService } from "@/hooks/queries";
import Button from "@/components/Button";

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
      <p className="service-form-label">Novo serviço</p>

      <label className="service-form-field">
        <span>Nome do serviço</span>
        <div className="service-form-input-wrap">
          <Tag size={16} aria-hidden="true" />
          <input
            aria-label="Nome do serviço"
            placeholder="Ex.: Manicure"
            value={name}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
      </label>

      <div className="service-form-row">
        <label className="service-form-field">
          <span>Preço</span>
          <div className="service-form-input-wrap">
            <Euro size={16} aria-hidden="true" />
            <input
              aria-label="Preço em euros"
              placeholder="0,00"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={price}
              autoComplete="off"
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
        </label>
        <label className="service-form-field">
          <span>Duração</span>
          <div className="service-form-input-wrap">
            <Clock size={16} aria-hidden="true" />
            <input
              aria-label="Duração em minutos"
              placeholder="30"
              type="number"
              inputMode="numeric"
              min="1"
              value={durationMin}
              autoComplete="off"
              onChange={(e) => setDurationMin(e.target.value)}
              required
            />
            <span className="service-form-input-suffix">min</span>
          </div>
        </label>
      </div>

      <Button type="submit" disabled={createService.isPending}>
        <Plus size={16} aria-hidden="true" />
        {createService.isPending ? "Salvando…" : "Adicionar serviço"}
      </Button>
    </form>
  );
}
