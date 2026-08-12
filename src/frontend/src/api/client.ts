import { getAccessToken, refreshAccessToken } from "@/auth/auth";

export interface User {
  id: string;
  tenant_id: string;
  name: string;
  role: "admin" | "user";
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
  created_by: string;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "declined" | "cancelled";
  customer_name: string;
  service_name: string;
  service_price: string;
  service_duration_min: number;
}

export interface AccessTokenWithUser {
  access_token: string;
  user: User;
}

export type DayHours = { open: string; close: string } | null;

export interface CompanySettings {
  timezone: string;
  slot_interval_min: number;
  min_lead_time_min: number;
  business_hours: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", DayHours>;
}

export interface Company {
  id: string;
  slug: string;
  name: string;
  settings: CompanySettings;
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
  registerCompany: (payload: { company_name: string; company_slug: string; admin_name: string; password: string }) =>
    request<User>("/api/auth/register-company", { method: "POST", body: JSON.stringify(payload) }),
  registerCustomer: (tenantSlug: string, payload: { name: string; password: string }) =>
    request<User>(`/api/auth/${tenantSlug}/register`, { method: "POST", body: JSON.stringify(payload) }),
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

  agendamentos: () => request<Agendamento[]>("/api/agendamentos"),
  createAgendamento: (payload: { service_id: string; start_time: string }) =>
    request<Agendamento>("/api/agendamentos", { method: "POST", body: JSON.stringify(payload) }),
  updateAgendamentoStatus: (id: string, status: "confirmed" | "declined" | "cancelled") =>
    request<Agendamento>(`/api/agendamentos/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
};
