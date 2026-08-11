import { NavLink, Outlet, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/router/ProtectedRoute";
import { useCurrentUser } from "@/auth/user";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import ServicesPage from "@/pages/ServicesPage";
import AgendamentosPage from "@/pages/AgendamentosPage";

function AppShell() {
  const { user, logout } = useCurrentUser();
  return (
    <div className="app-shell">
      <nav className="app-nav">
        <NavLink to="/">Painel</NavLink>
        <NavLink to="/services">Serviços</NavLink>
        <NavLink to="/agendamentos">Agendamentos</NavLink>
        <span className="app-nav-spacer" />
        <span className="app-nav-user">{user?.name}</span>
        <button type="button" onClick={() => void logout()}>
          Sair
        </button>
      </nav>
      <main>
        <Outlet />
      </main>
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
          <Route path="/agendamentos" element={<AgendamentosPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
