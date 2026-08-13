import { useEffect, useState } from "react";
import { NavLink, Outlet, Route, Routes } from "react-router-dom";
import { Briefcase, CalendarCheck, LayoutGrid, LogOut, Moon, Sun } from "lucide-react";
import ProtectedRoute from "@/router/ProtectedRoute";
import { useCurrentUser } from "@/auth/user";
import { useMyCompany } from "@/hooks/queries";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import NotificationBell from "@/components/NotificationBell";
import StartingSoonIndicator from "@/components/StartingSoonIndicator";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import ServicesPage from "@/pages/ServicesPage";
import BookingPage from "@/pages/BookingPage";
import AgendamentosPage from "@/pages/AgendamentosPage";

const NAV_ITEMS = [
  { to: "/", label: "Painel", icon: LayoutGrid, end: true },
  { to: "/agendamentos", label: "Agendamentos", icon: CalendarCheck, end: false },
  { to: "/services", label: "Serviços", icon: Briefcase, end: false },
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

  useNotificationStream(user?.role === "admin");

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
          {user?.role === "admin" && (
            <>
              <StartingSoonIndicator />
              <NotificationBell />
            </>
          )}
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
            <span className="app-nav-avatar" title={user.name} aria-hidden="true">
              {initialsOf(user.name)}
            </span>
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/book/:serviceId" element={<BookingPage />} />
          <Route path="/agendamentos" element={<AgendamentosPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
