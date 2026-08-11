import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useCurrentUser } from "@/auth/user";

type Mode = "customer" | "company";

export default function RegisterPage() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("customer");
  const [tenantSlug, setTenantSlug] = useState("");
  const [companyName, setCompanySlug] = useState("");
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
      if (mode === "customer") {
        await api.registerCustomer(tenantSlug, { name, password });
      } else {
        await api.registerCompany({
          company_name: companyName,
          company_slug: tenantSlug,
          admin_name: name,
          password,
        });
      }
      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cadastrar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <form onSubmit={handleSubmit} className="auth-form">
        <h1>Cadastrar</h1>
        <div className="register-mode-toggle">
          <button type="button" className={mode === "customer" ? "active" : ""} onClick={() => setMode("customer")}>
            Sou cliente
          </button>
          <button type="button" className={mode === "company" ? "active" : ""} onClick={() => setMode("company")}>
            Sou uma empresa
          </button>
        </div>

        {mode === "company" && (
          <input
            placeholder="Nome da empresa"
            value={companyName}
            onChange={(e) => setCompanySlug(e.target.value)}
            required
          />
        )}
        <input
          placeholder="Slug da empresa (ex: acme)"
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          pattern="^[a-z0-9-]+$"
          required
        />
        <input
          placeholder={mode === "company" ? "Seu nome (administrador)" : "Seu nome"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          placeholder="Senha"
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Cadastrando…" : "Cadastrar"}
        </button>
        <p>
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
