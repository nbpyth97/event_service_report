import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Building2, Eye, EyeOff, Lock, Phone, Tag, User } from "lucide-react";
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
  const [phone, setPhone] = useState("");
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
      if (mode === "customer") {
        await api.registerCustomer(tenantSlug, { name, password, phone: phone.trim() || undefined });
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
        MEETING SCHEDULER · NOVO CADASTRO
      </div>

      <form onSubmit={handleSubmit} className={`auth-card${shake ? " auth-card-shake" : ""}`}>
        <span className="auth-corner auth-corner-tl" aria-hidden="true" />
        <span className="auth-corner auth-corner-tr" aria-hidden="true" />
        <span className="auth-corner auth-corner-bl" aria-hidden="true" />
        <span className="auth-corner auth-corner-br" aria-hidden="true" />

        <h1 className="auth-title">Cadastrar</h1>
        <p className="auth-subtitle">Crie sua conta para começar a agendar.</p>

        <div className="register-mode-toggle">
          <button type="button" className={mode === "customer" ? "active" : ""} onClick={() => setMode("customer")}>
            Sou cliente
          </button>
          <button type="button" className={mode === "company" ? "active" : ""} onClick={() => setMode("company")}>
            Sou uma empresa
          </button>
        </div>

        {mode === "company" && (
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
                onChange={(e) => setCompanySlug(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        <div className="auth-field">
          <label className="auth-label" htmlFor="register-slug">
            Slug da empresa
          </label>
          <div className="service-form-input-wrap">
            <Tag size={16} aria-hidden="true" />
            <input
              id="register-slug"
              placeholder="ex: acme"
              type="search"
              value={tenantSlug}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setTenantSlug(e.target.value)}
              pattern="^[a-z0-9-]+$"
              required
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="register-name">
            {mode === "company" ? "Seu nome (administrador)" : "Seu nome"}
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

        {mode === "customer" && (
          <div className="auth-field">
            <label className="auth-label" htmlFor="register-phone">
              Telemóvel (opcional)
            </label>
            <div className="service-form-input-wrap">
              <Phone size={16} aria-hidden="true" />
              <input
                id="register-phone"
                placeholder="+351 912 345 678"
                type="tel"
                value={phone}
                autoComplete="tel"
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <p className="auth-field-hint">Usado apenas para contacto via WhatsApp sobre as suas marcações.</p>
          </div>
        )}

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

        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? "Cadastrando…" : "Cadastrar"}
        </button>
      </form>

      <p className="auth-hint">
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </div>
  );
}
