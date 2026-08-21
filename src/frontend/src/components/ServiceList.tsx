import { useState, type FormEvent } from "react";
import { Clock, Euro, Pencil, Save, Tag, Trash2, X } from "lucide-react";
import type { Service } from "@/api/client";
import { useDeleteService, useUpdateService } from "@/hooks/queries";
import { useToast } from "@/lib/toast";
import { fmtPrice } from "@/lib/format";
import Button from "@/components/Button";

function ActiveToggle({ service }: { service: Service }) {
  const updateService = useUpdateService();
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={service.active}
        disabled={updateService.isPending}
        onChange={(e) => updateService.mutate({ id: service.id, payload: { active: e.target.checked } })}
        aria-label={service.active ? `Desativar ${service.name}` : `Ativar ${service.name}`}
      />
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      <span className={`switch-label ${service.active ? "switch-label-active" : "switch-label-inactive"}`}>
        {service.active ? "Ativo" : "Inativo"}
      </span>
    </label>
  );
}

function EditServiceForm({ service, onDone }: { service: Service; onDone: () => void }) {
  const [name, setName] = useState(service.name);
  const [price, setPrice] = useState(String(service.price));
  const [durationMin, setDurationMin] = useState(String(service.duration_min));
  // See CustomerEditModal.tsx for why: neither autocomplete="off" nor
  // "new-password" alone stops Chrome/Android's autofill accessory strip —
  // loading readOnly and lifting that only on focus is the remaining lever.
  const [nameLocked, setNameLocked] = useState(true);
  const updateService = useUpdateService();
  const { showSuccess } = useToast();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateService.mutate(
      { id: service.id, payload: { name, price, duration_min: Number(durationMin) } },
      {
        onSuccess: () => {
          showSuccess(`${name} atualizado.`);
          onDone();
        },
      }
    );
  };

  return (
    <form className="service-card-edit" onSubmit={handleSubmit}>
      <label className="service-form-field">
        <span>Nome do serviço</span>
        <div className="service-form-input-wrap">
          <Tag size={16} aria-hidden="true" />
          <input
            aria-label="Nome do serviço"
            value={name}
            readOnly={nameLocked}
            onFocus={() => setNameLocked(false)}
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore
            name="cf-svc-name-edit"
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

      <div className="service-card-edit-actions">
        <Button variant="cancel" onClick={onDone}>
          <X size={15} aria-hidden="true" />
          Cancelar
        </Button>
        <Button type="submit" disabled={updateService.isPending}>
          <Save size={15} aria-hidden="true" />
          {updateService.isPending ? "A guardar…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const deleteService = useDeleteService();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <li className={`service-card service-card-editing${service.active ? "" : " service-card-inactive"}`}>
        <EditServiceForm service={service} onDone={() => setIsEditing(false)} />
      </li>
    );
  }

  return (
    <li className={`service-card${service.active ? "" : " service-card-inactive"}`}>
      <div className="service-card-main service-card-main-dimmable">
        <span className="service-card-name">{service.name}</span>
        <span className="service-card-meta">
          {fmtPrice(service.price)} · {service.duration_min} min
        </span>
      </div>

      {!confirmingRemove && (
        <div className="service-card-actions">
          <ActiveToggle service={service} />
          <Button
            variant="outline"
            className="btn-labeled"
            onClick={() => setIsEditing(true)}
            aria-label={`Editar ${service.name}`}
          >
            <Pencil size={14} aria-hidden="true" />
            Editar
          </Button>
          <Button variant="danger-outline" className="btn-labeled" onClick={() => setConfirmingRemove(true)}>
            <Trash2 size={14} aria-hidden="true" />
            Remover
          </Button>
        </div>
      )}

      {confirmingRemove && (
        <div className="ticket-decline-confirm">
          <p>Remover {service.name}? Pode reativar depois em "Inativo".</p>
          <Button variant="cancel" onClick={() => setConfirmingRemove(false)}>
            <X size={15} aria-hidden="true" />
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => deleteService.mutate(service.id)} disabled={deleteService.isPending}>
            <Trash2 size={15} aria-hidden="true" />
            {deleteService.isPending ? "A remover…" : "Sim, remover"}
          </Button>
        </div>
      )}
    </li>
  );
}

export default function ServiceList({ services }: { services: Service[] }) {
  if (services.length === 0) return <p className="muted">Nenhum serviço cadastrado.</p>;

  const activeServices = services.filter((s) => s.active);
  const inactiveServices = services.filter((s) => !s.active);

  // Two visually separate groups (proximity, not just a color) — active
  // services first, a wider gap, then inactive ones under their own count.
  // Each group's own count is its section label instead of a shared summary
  // row, so "how many are live" reads at the point where it's relevant.
  return (
    <div className="service-list-groups">
      <div className="service-list-group">
        <p className="service-list-section-label service-list-section-label-active">
          {activeServices.length} ativo{activeServices.length === 1 ? "" : "s"}
        </p>
        <ul className="service-card-list">
          {activeServices.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </ul>
      </div>

      {inactiveServices.length > 0 && (
        <div className="service-list-group service-list-group-inactive">
          <p className="service-list-section-label service-list-section-label-inactive">
            {inactiveServices.length} inativo{inactiveServices.length === 1 ? "" : "s"}
          </p>
          <ul className="service-card-list">
            {inactiveServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
