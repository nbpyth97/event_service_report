import { getAccessToken, refreshAccessToken } from "@/auth/auth";

// Staff only — a customer has no account (see Customer below), so there is no
// role to branch on: anyone the frontend has a User for is staff.
export interface User {
  id: string;
  tenant_id: string;
  name: string;
}

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  price: string;
  duration_min: number;
  active: boolean;
  created_by: string;
}

export interface Agendamento {
  id: string;
  tenant_id: string;
  service_id: string;
  customer_id: string;
  created_by: string | null;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "declined" | "cancelled";
  customer_name: string;
  customer_alias: string | null;
  customer_phone: string | null;
  service_name: string;
  service_price: string;
  service_duration_min: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  alias: string | null;
}

export interface AgendamentoStatusHistoryEntry {
  from_status: Agendamento["status"] | null;
  to_status: Agendamento["status"];
  changed_at: string;
}

export interface Notification {
  id: string;
  tenant_id: string;
  type: "booking_pending" | "booking_cancelled";
  agendamento_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
}

export interface AccessTokenWithUser {
  access_token: string;
  user: User;
}

export type DayHours = { open: string; close: string } | null;

export interface CompanySettings {
  // The zone slot times are generated and displayed in — fed to
  // lib/tz.ts::setDisplayTimeZone so labels read in the salon's local time
  // rather than the viewer's.
  timezone: string;
  // Step the availability picker walks a day by (candidates land on
  // :00/:15/:30/:45); a candidate is offered only if the service's full
  // duration_min fits free from there.
  slot_interval_min: number;
  business_hours: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", DayHours>;
}

export interface Company {
  id: string;
  slug: string;
  name: string;
  settings: CompanySettings;
  created_at: string;
}

// Every field optional (the backend patches key-by-key), but business_hours
// must carry all seven days when sent — a partial map is rejected.
export interface CompanyUpdate {
  name?: string;
  settings?: Partial<CompanySettings>;
}

export interface PublicCompany {
  name: string;
  business_hours: CompanySettings["business_hours"];
  timezone: string;
}

export interface RegisterCompanyResult extends User {
  tenant_slug: string;
}

export interface Availability {
  slots: string[];
}

const STATUS_MESSAGES: Record<number, string> = {
  401: "Sua sessão expirou. Faça login novamente.",
  403: "Você não tem permissão para fazer isso.",
  404: "Não encontrado.",
  409: "Já existe um registro com esses dados.",
  422: "Verifique os dados informados.",
  429: "Muitas tentativas. Aguarde um momento.",
  500: "Algo deu errado. Tente novamente.",
  503: "Serviço indisponível no momento.",
};

async function readError(res: Response): Promise<string> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return STATUS_MESSAGES[res.status] ?? "Algo deu errado. Tente novamente.";
  }
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { loc?: unknown[]; msg?: string };
    const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : undefined;
    if (first.msg) return field ? `${field}: ${first.msg}` : first.msg;
  }
  return STATUS_MESSAGES[res.status] ?? "Algo deu errado. Tente novamente.";
}

async function request<T>(path: string, options?: RequestInit, _retried = false): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (res.status === 401 && !_retried && !path.startsWith("/api/auth/")) {
    const newToken = await refreshAccessToken();
    if (newToken) return request<T>(path, options, true);
  }

  if (!res.ok) throw new Error(await readError(res));
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  registerCompany: (payload: { company_name: string; admin_name: string; password: string }) =>
    request<RegisterCompanyResult>("/api/auth/register-company", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: { tenant_slug: string; name: string; password: string }) =>
    request<AccessTokenWithUser>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),

  services: () => request<Service[]>("/api/services"),
  createService: (payload: { name: string; price: string; duration_min: number }) =>
    request<Service>("/api/services", { method: "POST", body: JSON.stringify(payload) }),
  updateService: (id: string, payload: Partial<{ name: string; price: string; duration_min: number; active: boolean }>) =>
    request<Service>(`/api/services/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteService: (id: string) => request<void>(`/api/services/${id}`, { method: "DELETE" }),
  availability: (serviceId: string, date: string) =>
    request<Availability>(`/api/services/${serviceId}/availability?date=${date}`),

  myCompany: () => request<Company>("/api/companies/me"),
  updateMyCompany: (payload: CompanyUpdate) =>
    request<Company>("/api/companies/me", { method: "PATCH", body: JSON.stringify(payload) }),

  customers: () => request<Customer[]>("/api/customers"),
  createCustomer: (payload: { name: string; phone: string }) =>
    request<Customer>("/api/customers", { method: "POST", body: JSON.stringify(payload) }),
  setCustomerAlias: (id: string, alias: string | null) =>
    request<Customer>(`/api/customers/${id}`, { method: "PATCH", body: JSON.stringify({ alias }) }),

  agendamentos: () => request<Agendamento[]>("/api/agendamentos"),
  createAgendamento: (payload: { service_id: string; start_time: string; customer_id: string }) =>
    request<Agendamento>("/api/agendamentos", { method: "POST", body: JSON.stringify(payload) }),
  updateAgendamentoStatus: (id: string, status: "confirmed" | "declined" | "cancelled") =>
    request<Agendamento>(`/api/agendamentos/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  agendamentoHistory: (id: string) => request<AgendamentoStatusHistoryEntry[]>(`/api/agendamentos/${id}/history`),

  notifications: () => request<Notification[]>("/api/notifications"),
  markNotificationRead: (id: string) => request<Notification>(`/api/notifications/${id}/read`, { method: "POST" }),

  // Unauthenticated — the public anonymous booking page (no account, no
  // token). Mirrors the authenticated service/availability/agendamento
  // shapes 1:1, scoped by tenant slug instead of a JWT's tenant_id.
  publicCompany: (slug: string) => request<PublicCompany>(`/api/public/${slug}/company`),
  publicServices: (slug: string) => request<Service[]>(`/api/public/${slug}/services`),
  publicAvailability: (slug: string, serviceId: string, date: string) =>
    request<Availability>(`/api/public/${slug}/services/${serviceId}/availability?date=${date}`),
  publicBook: (slug: string, payload: { service_id: string; start_time: string; name: string; phone: string }) =>
    request<Agendamento>(`/api/public/${slug}/book`, { method: "POST", body: JSON.stringify(payload) }),
};
