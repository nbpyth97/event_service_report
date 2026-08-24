import type { User } from "@/api/client";

export const SESSION_CLEARED_EVENT = "session-cleared";

const USER_STORAGE_KEY = "meeting_scheduler_user";

// The access token lives in memory only — never persisted — so it can't be
// pulled from localStorage by an XSS payload; a page reload triggers a
// silent refresh using the httpOnly refresh cookie instead.
let accessToken: string | null = null;
let user: User | null = loadUser();
let refreshInFlight: Promise<string | null> | null = null;

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function persistUser() {
  if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_STORAGE_KEY);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getUser(): User | null {
  return user;
}

export function setSession(newAccessToken: string, newUser: User) {
  accessToken = newAccessToken;
  user = newUser;
  persistUser();
}

export function clearSession() {
  accessToken = null;
  user = null;
  persistUser();
  window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
}

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
        if (!res.ok) {
          clearSession();
          return null;
        }
        const body = (await res.json()) as { access_token: string };
        accessToken = body.access_token;
        return accessToken;
      } catch {
        clearSession();
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}
