import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

export const queryKeys = {
  services: ["services"] as const,
  agendamentos: ["agendamentos"] as const,
  company: ["company"] as const,
  availability: (serviceId: string, date: string) => ["availability", serviceId, date] as const,
  notifications: ["notifications"] as const,
  agendamentoHistory: (agendamentoId: string) => ["agendamentoHistory", agendamentoId] as const,
  customers: ["customers"] as const,
  publicCompany: (slug: string) => ["publicCompany", slug] as const,
  publicServices: (slug: string) => ["publicServices", slug] as const,
  publicAvailability: (slug: string, serviceId: string, date: string) =>
    ["publicAvailability", slug, serviceId, date] as const,
};

export function useMyCompany() {
  return useQuery({ queryKey: queryKeys.company, queryFn: api.myCompany, staleTime: Infinity });
}

export function useUpdateMyCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateMyCompany,
    onSuccess: (company) => {
      // Written straight into the cache rather than invalidated: useMyCompany
      // is staleTime: Infinity, so an invalidate would leave AppShell (title,
      // and lib/tz.ts display zone) on the old values until a remount.
      qc.setQueryData(queryKeys.company, company);
      // Business hours and the slot grid both feed _candidate_slots — every
      // cached day of availability is now potentially wrong.
      qc.invalidateQueries({ queryKey: ["availability"] });
      qc.invalidateQueries({ queryKey: ["publicAvailability"] });
    },
  });
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

export function useCustomers() {
  return useQuery({ queryKey: queryKeys.customers, queryFn: api.customers });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createCustomer,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.customers }),
  });
}

export function useSetCustomerAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, alias }: { id: string; alias: string | null }) => api.setCustomerAlias(id, alias),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.customers });
      // The alias also shows up denormalized on every Agendamento row
      // (customer_alias) — refetch those too so list/calendar views pick it
      // up without waiting on their own unrelated invalidation.
      qc.invalidateQueries({ queryKey: queryKeys.agendamentos });
    },
  });
}

export function usePublicCompany(slug: string) {
  return useQuery({ queryKey: queryKeys.publicCompany(slug), queryFn: () => api.publicCompany(slug), staleTime: Infinity });
}

export function usePublicServices(slug: string) {
  return useQuery({ queryKey: queryKeys.publicServices(slug), queryFn: () => api.publicServices(slug) });
}

export function usePublicAvailability(slug: string, serviceId: string, date: string | null) {
  return useQuery({
    queryKey: queryKeys.publicAvailability(slug, serviceId, date ?? ""),
    queryFn: () => api.publicAvailability(slug, serviceId, date as string),
    enabled: Boolean(slug) && Boolean(serviceId) && Boolean(date),
  });
}

export function usePublicBook() {
  return useMutation({
    mutationFn: ({ slug, payload }: { slug: string; payload: Parameters<typeof api.publicBook>[1] }) =>
      api.publicBook(slug, payload),
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
