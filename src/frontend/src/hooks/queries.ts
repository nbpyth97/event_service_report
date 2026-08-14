import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

export const queryKeys = {
  services: ["services"] as const,
  agendamentos: ["agendamentos"] as const,
  company: ["company"] as const,
  availability: (serviceId: string, date: string) => ["availability", serviceId, date] as const,
  notifications: ["notifications"] as const,
  agendamentoHistory: (agendamentoId: string) => ["agendamentoHistory", agendamentoId] as const,
};

export function useMyCompany() {
  return useQuery({ queryKey: queryKeys.company, queryFn: api.myCompany, staleTime: Infinity });
}

export function useAvailability(serviceId: string, date: string | null) {
  return useQuery({
    queryKey: queryKeys.availability(serviceId, date ?? ""),
    queryFn: () => api.availability(serviceId, date as string),
    enabled: Boolean(serviceId) && Boolean(date),
  });
}

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
  return useQuery({ queryKey: queryKeys.agendamentos, queryFn: api.agendamentos, refetchInterval: 5 * 60 * 1000 });
}

export function useCreateAgendamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createAgendamento,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agendamentos });
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}

export function useUpdateAgendamentoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "confirmed" | "declined" | "cancelled" }) =>
      api.updateAgendamentoStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agendamentos });
      // Confirming/declining a pending booking resolves its "new booking"
      // notification server-side — refetch so the bell's count/card for it
      // disappears immediately instead of waiting on the next SSE push.
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useNotifications() {
  return useQuery({ queryKey: queryKeys.notifications, queryFn: api.notifications });
}

export function useAgendamentoHistory(agendamentoId: string) {
  return useQuery({
    queryKey: queryKeys.agendamentoHistory(agendamentoId),
    queryFn: () => api.agendamentoHistory(agendamentoId),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}
