import { useState, type FormEvent } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { Building2, Copy, Eye, EyeOff, Lock, User } from "lucide-react";
import { api } from "@/api/client";
import { useCurrentUser } from "@/auth/user";
import { useToast } from "@/lib/toast";
import Button from "@/components/Button";

// Customers never had a "register" flow of their own on this page anymore —
// they book from the public /marcar-agendamento link with just name+phone,
// no account (see PublicBookingPage.tsx). This page only creates a new
// company + its first admin login.
export default function RegisterPage() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const { showSuccess } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.registerCompany({ company_name: companyName, admin_name: name, password });
      setTenantSlug(result.tenant_slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cadastrar.");
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } finally {
      setSubmitting(false);
    }
  };

  if (tenantSlug) {
    const bookingLink = `${window.location.origin}/marcar-agendamento?company=${tenantSlug}`;
    const copyLink = () => {
      navigator.clipboard.writeText(bookingLink);
      showSuccess("Link copiado.");
    };

    return (
      <div className="auth-screen">
        <div className="auth-eyebrow">
          <span className="auth-status-dot" aria-hidden="true" />
          MEETING SCHEDULER · EMPRESA CRIADA
        </div>
        <div className="auth-card">
          <h1 className="auth-title">Empresa criada!</h1>
          <p className="auth-subtitle">
            O endereço da sua empresa é <strong>{tenantSlug}</strong>. Guarde o link abaixo — é o que os seus
            clientes vão usar para marcar horário, sem precisar de conta.
          </p>
          <div className="auth-field">
            <label className="auth-label">Link para os clientes marcarem</label>
            <div className="service-form-input-wrap">
              <input value={bookingLink} readOnly onFocus={(e) => e.target.select()} />
              <button type="button" className="auth-input-adorn" onClick={copyLink} aria-label="Copiar link">
                <Copy size={16} />
              </button>
            </div>
          </div>
          <Button className="auth-submit" onClick={() => navigate(`/entrar?company=${tenantSlug}`)}>
            Ir para o login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-eyebrow">
        <span className="auth-status-dot" aria-hidden="true" />
        MEETING SCHEDULER · NOVO CADASTRO
      </div>

      <form onSubmit={handleSubmit} className={`auth-card${shake ? " auth-card-shake" : ""}`}>
        <span className="auth-corner auth-corner-tl" aria-hidden="true" />
        <span className="auth-corner auth-corner-tr" aria-hidden="true" />
        <span className="auth-corner auth-corner-bl" aria-hidden="true" />
        <span className="auth-corner auth-corner-br" aria-hidden="true" />

        <h1 className="auth-title">Cadastrar empresa</h1>
        <p className="auth-subtitle">Crie a conta da sua empresa para começar a gerir marcações.</p>

        <div className="auth-field">
          <label className="auth-label" htmlFor="company-name">
            Nome da empresa
          </label>
          <div className="service-form-input-wrap">
            <Building2 size={16} aria-hidden="true" />
            <input
              id="company-name"
              placeholder="Nome da empresa"
              value={companyName}
              autoComplete="organization"
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="register-name">
            Seu nome (administrador)
          </label>
          <div className="service-form-input-wrap">
            <User size={16} aria-hidden="true" />
            <input
              id="register-name"
              placeholder="Nome"
              value={name}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="register-password">
            Senha
          </label>
          <div className="service-form-input-wrap">
            <Lock size={16} aria-hidden="true" />
            <input
              id="register-password"
              placeholder="Senha"
              type={showPassword ? "text" : "password"}
              minLength={8}
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="auth-input-adorn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? "Cadastrando…" : "Cadastrar"}
        </Button>
      </form>

      <p className="auth-hint">
        Já tem conta? <Link to="/entrar">Entrar</Link>
      </p>
    </div>
  );
}
