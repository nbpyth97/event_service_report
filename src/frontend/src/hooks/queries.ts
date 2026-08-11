import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

export const queryKeys = {
  services: ["services"] as const,
  agendamentos: ["agendamentos"] as const,
};

export function useServices() {
  return useQuery({ queryKey: queryKeys.services, queryFn: api.services });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createService,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.services }),
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof api.updateService>[1] }) =>
      api.updateService(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.services }),
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteService,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.services }),
  });
}

export function useAgendamentos() {
  return useQuery({ queryKey: queryKeys.agendamentos, queryFn: api.agendamentos });
}

export function useCreateAgendamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createAgendamento,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.agendamentos }),
  });
}

export function useUpdateAgendamentoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "confirmed" | "declined" | "cancelled" }) =>
      api.updateAgendamentoStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.agendamentos }),
  });
}
