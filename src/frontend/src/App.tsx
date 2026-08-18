import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Briefcase, CalendarCheck, LayoutGrid, LogOut, Moon, Sun, Users } from "lucide-react";
import ProtectedRoute from "@/router/ProtectedRoute";
import { useCurrentUser } from "@/auth/user";
import { useMyCompany } from "@/hooks/queries";
import { setDisplayTimeZone } from "@/lib/tz";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import NotificationBell from "@/components/NotificationBell";
import StartingSoonIndicator from "@/components/StartingSoonIndicator";
import LoginPage from "@/pages/public/LoginPage";
import RegisterPage from "@/pages/public/RegisterPage";
import PublicBookingPage from "@/pages/public/PublicBookingPage";
import DashboardPage from "@/pages/DashboardPage";
import ServicesPage from "@/pages/ServicesPage";
import BookingPage from "@/pages/BookingPage";
import AgendamentosPage from "@/pages/AgendamentosPage";
import CustomersPage from "@/pages/CustomersPage";
import CompanySettingsPage from "@/pages/CompanySettingsPage";

const NAV_ITEMS = [
  { to: "/", label: "Painel", icon: LayoutGrid, end: true },
  { to: "/agendamentos", label: "Agendamentos", icon: CalendarCheck, end: false },
  { to: "/servicos", label: "Serviços", icon: Briefcase, end: false },
  { to: "/clientes", label: "Clientes", icon: Users, end: false },
];

type Theme = "light" | "dark";
const THEME_KEY = "meeting-scheduler.theme";

function initialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Applied at module load (not inside a component) so the theme is correct on
// first paint no matter which route loads first — AppShell (where the
// toggle lives) never mounts on /login, so waiting for its effect would
// leave the login screen stuck on the default theme after a refresh.
document.documentElement.dataset.theme = initialTheme();

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

function AppShell() {
  const { user, logout } = useCurrentUser();
  const { data: company } = useMyCompany();
  const [theme, setTheme] = useState<Theme>(initialTheme);

  // Set during render, not in an effect: every formatter reads this at call
  // time, so an effect would let the first paint after login print times in
  // the viewer's zone before correcting itself. Idempotent, so React's
  // double-render in StrictMode is harmless.
  setDisplayTimeZone(company?.settings.timezone);

  useNotificationStream(Boolean(user));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Saltar para o conteúdo
      </a>
      <header className="app-topbar">
        <div className="app-topbar-identity">
          <span className="app-topbar-brand">{company?.name ?? "Meeting Scheduler"}</span>
          <span className="app-topbar-powered">
            by <span className="app-topbar-powered-brand">Meeting Scheduler</span>
          </span>
        </div>
        <div className="app-nav-account">
          <StartingSoonIndicator />
          <NotificationBell />
          <span className="app-nav-divider" aria-hidden="true" />
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
            title={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
          >
            {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
          </button>
          {user && (
            /* The avatar is the only entry point to company settings — it is
               deliberately not in NAV_ITEMS, since the bottom nav is for the
               four day-to-day surfaces and settings is visited rarely. */
            <NavLink
              to="/definicoes"
              className="app-nav-avatar"
              title={`${user.name} — definições`}
              aria-label="Definições da empresa"
            >
              {initialsOf(user.name)}
            </NavLink>
          )}
          <span className="app-nav-divider app-nav-divider-wide" aria-hidden="true" />
          <button
            type="button"
            className="app-nav-logout app-nav-logout-danger"
            onClick={() => void logout()}
            aria-label="Sair"
            title="Sair"
          >
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>

      <nav className="bottom-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : "")}>
            <Icon className="nav-icon" aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

// Two scopes, and the folder layout mirrors them: pages/public/* render with
// no guard and no AppShell (a customer never logs in — see
// pages/public/PublicBookingPage.tsx), everything else sits behind
// ProtectedRoute and is staff-only by definition, since every account that can
// log in is staff. Paths are Portuguese throughout, matching the UI language.
export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<LoginPage />} />
      <Route path="/registar" element={<RegisterPage />} />
      <Route path="/marcar-agendamento" element={<PublicBookingPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/servicos" element={<ServicesPage />} />
          <Route path="/servicos/:serviceId/marcar" element={<BookingPage />} />
          <Route path="/agendamentos" element={<AgendamentosPage />} />
          <Route path="/clientes" element={<CustomersPage />} />
          <Route path="/definicoes" element={<CompanySettingsPage />} />
        </Route>
      </Route>
      {/* Catches the pre-rename English paths (/services, /customers, …) and
          anything else unknown, rather than rendering an empty AppShell. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
