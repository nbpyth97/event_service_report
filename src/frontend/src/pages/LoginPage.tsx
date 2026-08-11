import { useState, type FormEvent } from "react";
import { Navigate, Link } from "react-router-dom";
import { useCurrentUser } from "@/auth/user";

export default function LoginPage() {
  const { user, login } = useCurrentUser();
  const [tenantSlug, setTenantSlug] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(tenantSlug, name, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <form onSubmit={handleSubmit} className="auth-form">
        <h1>Entrar</h1>
        <input
          placeholder="Empresa (slug)"
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          required
        />
        <input placeholder="Usuário" value={name} onChange={(e) => setName(e.target.value)} required />
        <input
          placeholder="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Entrando…" : "Entrar"}
        </button>
        <p>
          Não tem conta? <Link to="/register">Cadastre-se</Link>
        </p>
      </form>
    </div>
  );
}
