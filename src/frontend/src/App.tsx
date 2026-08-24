import { NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Briefcase, CalendarCheck, LayoutGrid, Users } from "lucide-react";
import ProtectedRoute from "@/router/ProtectedRoute";
import { useCurrentUser } from "@/auth/user";
import { useMyCompany } from "@/hooks/queries";
import { setDisplayTimeZone } from "@/lib/tz";
import { useNotificationStream } from "@/hooks/useNotificationStream";
// Side-effect import — see hooks/applyStoredTheme.ts.
import "@/hooks/applyStoredTheme";
import NotificationBell from "@/components/NotificationBell";
import StartingSoonIndicator from "@/components/StartingSoonIndicator";
import ProfileMenu from "@/components/ProfileMenu";
import LoginPage from "@/pages/public/LoginPage";
// Self-service signup is switched off — see the route below.
// import RegisterPage from "@/pages/public/RegisterPage";
import PublicBookingPage from "@/pages/public/PublicBookingPage";
import DashboardPage from "@/pages/DashboardPage";
import ServicesPage from "@/pages/ServicesPage";
import BookingPage from "@/pages/BookingPage";
import AgendamentosPage from "@/pages/AgendamentosPage";
import CustomersPage from "@/pages/CustomersPage";
import CompanySettingsPage from "@/pages/CompanySettingsPage";

// Ordered by how often staff reach for each during a working day, not by
// how they were built — Agendamentos and Clientes are the constant-contact
// tools during active bookings, so they sit in the easiest thumb reach on
// the left; Serviços (setup) and Painel (a periodic overview, not a
// workflow) trail toward the edge.
const NAV_ITEMS = [
  { to: "/agendamentos", label: "Marcações", icon: CalendarCheck, end: false },
  { to: "/clientes", label: "Clientes", icon: Users, end: false },
  { to: "/servicos", label: "Serviços", icon: Briefcase, end: false },
  { to: "/", label: "Painel", icon: LayoutGrid, end: true },
];

function AppShell() {
  const { user, logout } = useCurrentUser();
  const { data: company } = useMyCompany();

  // Set during render, not in an effect: every formatter reads this at call
  // time, so an effect would let the first paint after login print times in
  // the viewer's zone before correcting itself. Idempotent, so React's
  // double-render in StrictMode is harmless.
  setDisplayTimeZone(company?.settings.timezone);

  useNotificationStream(Boolean(user));

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
          <NotificationBell />
          <StartingSoonIndicator />
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
        {/* Settings + logout, not a route of its own — see ProfileMenu.tsx
            for why it sits here instead of the top-right corner. */}
        {user && <ProfileMenu userName={user.name} onLogout={() => void logout()} />}
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
      {/* Self-service company signup is disabled on purpose: there are no
          email notifications yet, so nothing can send a confirmation link to
          verify a new company. New tenants are onboarded manually until that
          exists (few B2B customers, so this is cheap). RegisterPage.tsx is
          kept intact — re-enable by uncommenting this route and its import.
          Note POST /api/auth/register is still open on the backend. */}
      {/* <Route path="/registar" element={<RegisterPage />} /> */}
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
