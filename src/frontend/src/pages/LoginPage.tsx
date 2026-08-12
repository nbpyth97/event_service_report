import { useState, type FormEvent } from "react";
import { Navigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useCurrentUser } from "@/auth/user";

export default function LoginPage() {
  const { user, login } = useCurrentUser();
  const [tenantSlug, setTenantSlug] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(tenantSlug, name, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-eyebrow">
        <span className="auth-status-dot" aria-hidden="true" />
        MEETING SCHEDULER · ACESSO SEGURO
      </div>

      <form onSubmit={handleSubmit} className={`auth-card${shake ? " auth-card-shake" : ""}`}>
        <span className="auth-corner auth-corner-tl" aria-hidden="true" />
        <span className="auth-corner auth-corner-tr" aria-hidden="true" />
        <span className="auth-corner auth-corner-bl" aria-hidden="true" />
        <span className="auth-corner auth-corner-br" aria-hidden="true" />

        <h1 className="auth-title">Entrar</h1>
        <p className="auth-subtitle">Informe a empresa, usuário e senha para continuar.</p>

        <div className="auth-field">
          <label className="auth-label" htmlFor="tenant-slug">
            Empresa
          </label>
          <input
            id="tenant-slug"
            placeholder="ex: acme"
            value={tenantSlug}
            autoFocus
            onChange={(e) => setTenantSlug(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="login-name">
            Usuário
          </label>
          <input
            id="login-name"
            placeholder="Usuário"
            value={name}
            autoComplete="username"
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="login-password">
            Senha
          </label>
          <div className="auth-input-group">
            <input
              id="login-password"
              placeholder="Senha"
              type={showPassword ? "text" : "password"}
              value={password}
              autoComplete="current-password"
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

        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="auth-hint">
        Não tem conta? <Link to="/register">Cadastre-se</Link>
      </p>
    </div>
  );
}
