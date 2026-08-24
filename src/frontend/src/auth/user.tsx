import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type User } from "@/api/client";
import { SESSION_CLEARED_EVENT, clearSession, getUser, refreshAccessToken, setSession } from "@/auth/auth";

interface CurrentUserContextValue {
  user: User | null;
  loading: boolean;
  login: (tenantSlug: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getUser());
  const [loading, setLoading] = useState(() => getUser() !== null);

  useEffect(() => {
    if (!loading) return;
    refreshAccessToken().finally(() => setLoading(false));
  }, [loading]);

  useEffect(() => {
    const onSessionCleared = () => setUser(null);
    window.addEventListener(SESSION_CLEARED_EVENT, onSessionCleared);
    return () => window.removeEventListener(SESSION_CLEARED_EVENT, onSessionCleared);
  }, []);

  const login = async (tenantSlug: string, name: string, password: string) => {
    const res = await api.login({ tenant_slug: tenantSlug, name, password });
    setSession(res.access_token, res.user);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      clearSession();
      setUser(null);
    }
  };

  return (
    <CurrentUserContext.Provider value={{ user, loading, login, logout }}>{children}</CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): CurrentUserContextValue {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) throw new Error("useCurrentUser must be used within CurrentUserProvider");
  return ctx;
}
