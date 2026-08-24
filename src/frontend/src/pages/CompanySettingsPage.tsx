import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Briefcase, Building2, Check, Clock, Coffee, Copy, ExternalLink, Link2, Moon, Save, Sun, Timer } from "lucide-react";
import { useMyCompany, useUpdateMyCompany } from "@/hooks/queries";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/lib/toast";
import Button from "@/components/Button";
import type { Company, CompanySettings, DayHours } from "@/api/client";

type DowKey = keyof CompanySettings["business_hours"];

// Monday-first, unlike lib/date.ts::DOW_KEYS (which is Sunday-first because it
// mirrors Date.getDay() for calendar-grid math) and unlike the backend's
// availability/service.py::DOW_KEYS (Monday-first because it mirrors Python's
// date.weekday()). Neither of those is indexed here — this list is read by a
// human scanning their own opening hours, and every key is written out
// literally, so the ordering is presentation only.
const WEEK: { key: DowKey; label: string }[] = [
  { key: "mon", label: "Segunda-feira" },
  { key: "tue", label: "Terça-feira" },
  { key: "wed", label: "Quarta-feira" },
  { key: "thu", label: "Quinta-feira" },
  { key: "fri", label: "Sexta-feira" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

// Seeded into a day the moment it is re-opened, so the time inputs are never
// blank (which would submit as invalid) after ticking a closed day back on.
const FALLBACK_OPEN = "09:00";
const FALLBACK_CLOSE = "18:00";

// Mirrors the ge/le bounds on CompanySettingsUpdate.slot_interval_min — the
// backend is the enforcement, this is just the message the admin sees first.
const MIN_SLOT_INTERVAL = 5;
const MAX_SLOT_INTERVAL = 120;

// Seeded into the lunch break the moment it is turned on, mirroring
// FALLBACK_OPEN/FALLBACK_CLOSE above.
const FALLBACK_BREAK_START = "13:00";
const FALLBACK_BREAK_END = "14:00";

// A closed day is `null` on the wire, but keeping the last typed hours (and
// per-day lunch break, for the granular mode below) in the form means
// unticking and re-ticking a day, or switching modes, never wipes them.
interface DayValues {
  isOpen: boolean;
  open: string;
  close: string;
  hasLunchBreak: boolean;
  lunchStart: string;
  lunchEnd: string;
}

interface SettingsFormValues {
  name: string;
  timezone: string;
  // Kept as the raw string the input produced rather than a number: that is
  // what lets the integer rule below reject "15.5" with a message instead of
  // silently coercing it (Number("15.5") is a perfectly good 15.5, which the
  // backend would then 422 on).
  slotIntervalMin: string;
  hours: Record<DowKey, DayValues>;
  // Lunch break is optional (many businesses don't run one at all) and can be
  // set two ways: one shared window for every open day (the common case, and
  // the default an admin lands on), or a per-day window via each day's own
  // hasLunchBreak/lunchStart/lunchEnd for tenants that only break some days
  // (e.g. Mon-Thu but not Fri/Sat). The backend always stores it per weekday
  // either way (schemas.py::DayHoursIn.lunch_break) — lunchApplyToAll is a
  // frontend-only convenience for filling all seven at once.
  lunchBreakEnabled: boolean;
  lunchApplyToAll: boolean;
  lunchStart: string;
  lunchEnd: string;
}

function toFormValues(company: Company): SettingsFormValues {
  const hours = {} as SettingsFormValues["hours"];
  // "Apply to all" only when every open day already agrees (including all
  // having none) — a tenant with genuinely different per-day breaks lands in
  // granular mode instead of silently collapsing them on the next save.
  const openSignatures = new Set<string>();
  let firstLunchBreak: { start: string; end: string } | null = null;

  for (const { key } of WEEK) {
    const day = company.settings.business_hours?.[key] ?? null;
    const lunchBreak = day?.lunch_break ?? null;
    hours[key] = {
      isOpen: day !== null,
      open: day?.open ?? FALLBACK_OPEN,
      close: day?.close ?? FALLBACK_CLOSE,
      hasLunchBreak: lunchBreak !== null,
      lunchStart: lunchBreak?.start ?? FALLBACK_BREAK_START,
      lunchEnd: lunchBreak?.end ?? FALLBACK_BREAK_END,
    };
    if (day !== null) {
      openSignatures.add(lunchBreak ? `${lunchBreak.start}-${lunchBreak.end}` : "none");
      if (lunchBreak && !firstLunchBreak) firstLunchBreak = lunchBreak;
    }
  }

  const applyToAll = openSignatures.size <= 1;
  const enabled = openSignatures.size === 0 ? false : applyToAll ? !openSignatures.has("none") : true;

  return {
    name: company.name,
    timezone: company.settings.timezone,
    slotIntervalMin: String(company.settings.slot_interval_min),
    hours,
    lunchBreakEnabled: enabled,
    lunchApplyToAll: applyToAll,
    lunchStart: firstLunchBreak?.start ?? FALLBACK_BREAK_START,
    lunchEnd: firstLunchBreak?.end ?? FALLBACK_BREAK_END,
  };
}

function toBusinessHours(values: SettingsFormValues): CompanySettings["business_hours"] {
  const out = {} as CompanySettings["business_hours"];
  for (const { key } of WEEK) {
    const d = values.hours[key];
    if (!d.isOpen) {
      out[key] = null as DayHours;
      continue;
    }
    const lunchBreak = !values.lunchBreakEnabled
      ? null
      : values.lunchApplyToAll
        ? { start: values.lunchStart, end: values.lunchEnd }
        : d.hasLunchBreak
          ? { start: d.lunchStart, end: d.lunchEnd }
          : null;
    out[key] = { open: d.open, close: d.close, lunch_break: lunchBreak } as DayHours;
  }
  return out;
}

// Every IANA zone the browser knows, so a company outside Europe/Lisbon is not
// stuck with a hardcoded shortlist. supportedValuesOf is recent enough to be
// worth a guard — falling back to just the current zone keeps the select
// valid (and effectively unchangeable) rather than empty.
function timeZoneOptions(current: string): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return all.includes(current) ? all : [current, ...all];
}

// Staff-only booking configuration, reached from the avatar in the top bar.
// Framed as "what determines when and how this tenant can receive bookings"
// rather than a bag of company fields, hence the four sections: the public
// link customers use, the company's identity, the booking grid, and the
// recurring weekly hours.
//
// Slug is shown but not editable — it is baked into every public booking link
// already shared with customers, so renaming it would break links still in
// circulation (the backend's CompanyUpdate omits it too).
export default function CompanySettingsPage() {
  const { data: company, isLoading } = useMyCompany();

  if (isLoading || !company) {
    return (
      <div className="page">
        <h1>Definições</h1>
        <p className="muted">A carregar…</p>
      </div>
    );
  }

  return (
    <div className="page settings-page">
      <h1>Definições</h1>
      <PublicLinkCard company={company} />
      <AppearanceCard />
      {/* Split out and keyed on the company so useForm's defaultValues are
          always seeded from real data: mounting the form before the query
          resolves would initialise every field empty and then need a reset to
          catch up, which is exactly what makes isDirty untrustworthy. */}
      <SettingsForm key={company.id} company={company} />
    </div>
  );
}

function PublicLinkCard({ company }: { company: Company }) {
  const { showError } = useToast();
  const [copied, setCopied] = useState(false);

  // Origin, not a hardcoded host: this is literally the address the admin is
  // looking at, so it is right in dev (localhost) and right in production
  // without a build-time config.
  const publicLink = `${window.location.origin}/marcar-agendamento?company=${company.slug}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showError("Não foi possível copiar a ligação.");
    }
  };

  return (
    <section className="settings-section settings-link-card">
      <p className="settings-section-title">
        <Link2 size={13} aria-hidden="true" /> Link público
      </p>
      <p className="muted settings-link-lead">Os seus clientes podem fazer marcações em:</p>
      {/* Rendered as a link, not a read-only input: an input field invites
          the question "can I edit this?", and the slug is permanent. */}
      <a className="settings-link-url" href={publicLink} target="_blank" rel="noreferrer">
        {publicLink}
      </a>
      <div className="settings-link-actions">
        <Button variant="ghost" onClick={() => void copyLink()}>
          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {copied ? "Copiado" : "Copiar ligação"}
        </Button>
        <a className="btn-ghost" href={publicLink} target="_blank" rel="noreferrer">
          <ExternalLink size={15} aria-hidden="true" />
          Ver como cliente
        </a>
      </div>
      <p className="muted settings-hint">
        O identificador <code>{company.slug}</code> é permanente porque este endereço já foi partilhado com clientes.
      </p>
    </section>
  );
}

// A device-local preference, not company data — kept out of SettingsForm's
// <form> so toggling it never trips react-hook-form's isDirty guard (which
// warns about leaving the page with unsaved changes). See hooks/useTheme.ts
// for why the toggle lives here instead of the top bar.
function AppearanceCard() {
  const [theme, setTheme] = useTheme();
  const isDark = theme === "dark";

  return (
    <section className="settings-section">
      <p className="settings-section-title">
        {isDark ? <Moon size={13} aria-hidden="true" /> : <Sun size={13} aria-hidden="true" />} Aparência
      </p>
      <label className="switch">
        <input
          type="checkbox"
          checked={isDark}
          onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
          aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
        />
        <span className="switch-track" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
        <span className={`switch-label ${isDark ? "switch-label-active" : "switch-label-inactive"}`}>
          {isDark ? "Escuro" : "Claro"}
        </span>
      </label>
    </section>
  );
}

function SettingsForm({ company }: { company: Company }) {
  const updateCompany = useUpdateMyCompany();
  const { showSuccess, showError } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsFormValues>({ defaultValues: toFormValues(company) });

  const hours = watch("hours");
  const lunchBreakEnabled = watch("lunchBreakEnabled");
  const lunchApplyToAll = watch("lunchApplyToAll");

  // Closing the tab is the one navigation this app cannot intercept from
  // React: BrowserRouter (main.tsx) is not a data router, so useBlocker is
  // unavailable and in-app navigation is guarded by the sticky bar below
  // instead. This covers reload/close, which is where silent loss hurts most.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const onSubmit = (values: SettingsFormValues) => {
    const original = toFormValues(company);

    // Only what actually changed — the backend merges settings key by key, so
    // an untouched field is left exactly as it is rather than rewritten.
    const settings: Partial<CompanySettings> = {};
    if (values.timezone !== original.timezone) settings.timezone = values.timezone;
    if (values.slotIntervalMin !== original.slotIntervalMin) {
      // Safe by now: the field's validate rule has already rejected anything
      // that is not a run of digits, so this can never be a fractional number.
      settings.slot_interval_min = Number(values.slotIntervalMin);
    }
    // Compares the actual wire shape rather than every individual form field —
    // open/close, the enabled flag, apply-all vs. per-day, all fold into one
    // business_hours object, so this is the one check that can't miss a
    // combination that changes the outcome without changing any single field.
    const newBusinessHours = toBusinessHours(values);
    if (JSON.stringify(newBusinessHours) !== JSON.stringify(toBusinessHours(original))) {
      settings.business_hours = newBusinessHours;
    }

    updateCompany.mutate(
      {
        ...(values.name !== original.name ? { name: values.name } : {}),
        ...(Object.keys(settings).length > 0 ? { settings } : {}),
      },
      {
        onSuccess: (saved) => {
          showSuccess("Alterações guardadas.");
          // Rebaselines defaultValues, which is what clears isDirty — seeded
          // from the server's response rather than the submitted values, so
          // anything the backend normalised shows up here too.
          reset(toFormValues(saved));
        },
        // The backend's detail is already Portuguese and specific — show it
        // rather than a generic replacement.
        onError: (err) => showError(err instanceof Error ? err.message : "Não foi possível guardar as definições."),
      }
    );
  };

  return (
    /* noValidate so RHF's Portuguese messages win over the browser's native
       validation bubbles, matching NewCustomerForm. */
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <section className="settings-section">
        <p className="settings-section-title">
          <Building2 size={13} aria-hidden="true" /> Empresa
        </p>

        <label className="service-form-field">
          <span>Nome da empresa</span>
          <div className="service-form-input-wrap">
            <input
              aria-label="Nome da empresa"
              maxLength={200}
              autoComplete="organization"
              aria-invalid={Boolean(errors.name)}
              disabled
              {...register("name", {
                required: "Indique o nome da empresa.",
                validate: (v) => v.trim().length > 0 || "Indique o nome da empresa.",
                setValueAs: (v: string) => v.trim(),
              })}
            />
          </div>
          <p className="muted settings-meta">Contacte o suporte para alterar o nome da empresa.</p>
          {errors.name && (
            <p className="form-error settings-field-error" role="alert">
              {errors.name.message}
            </p>
          )}
        </label>

        <label className="service-form-field">
          <span>Fuso horário</span>
          <div className="service-form-input-wrap">
            <select aria-label="Fuso horário" {...register("timezone")}>
              {timeZoneOptions(company.settings.timezone).map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </label>

        <p className="muted settings-meta">
          Empresa criada em {new Date(company.created_at).toLocaleDateString("pt-PT", { dateStyle: "long" })}
        </p>
      </section>

      <section className="settings-section">
        <p className="settings-section-title">
          <Timer size={13} aria-hidden="true" /> Agendamento
        </p>

        <label className="service-form-field settings-narrow-field">
          <span>Intervalo entre marcações</span>
          <div className="service-form-input-wrap">
            <input
              aria-label="Intervalo entre marcações em minutos"
              type="number"
              inputMode="numeric"
              min={MIN_SLOT_INTERVAL}
              max={MAX_SLOT_INTERVAL}
              step={1}
              aria-invalid={Boolean(errors.slotIntervalMin)}
              {...register("slotIntervalMin", {
                required: "Indique o intervalo em minutos.",
                validate: (v) => {
                  // Digits only. A minute is not divisible in this domain —
                  // the backend types slot_interval_min as an int and the
                  // availability grid steps by whole minutes, so "15.5" is
                  // not a rounding question, it is not a value. Tested
                  // against the raw string because Number() would happily
                  // accept the decimal, and type="number" on its own does not
                  // stop one being typed (or pasted).
                  if (!/^\d+$/.test(v.trim())) {
                    return "Indique um número inteiro de minutos, sem casas decimais.";
                  }
                  const n = Number(v);
                  if (n < MIN_SLOT_INTERVAL || n > MAX_SLOT_INTERVAL) {
                    return `O intervalo deve estar entre ${MIN_SLOT_INTERVAL} e ${MAX_SLOT_INTERVAL} minutos.`;
                  }
                  return true;
                },
              })}
            />
            <span className="service-form-input-suffix">min</span>
          </div>
          {errors.slotIntervalMin && (
            <p className="form-error settings-field-error" role="alert">
              {errors.slotIntervalMin.message}
            </p>
          )}
        </label>
        <p className="muted settings-hint">
          Define de quanto em quanto tempo <strong>pode começar</strong> uma marcação (09:00, 09:15, 09:30…). Não é a
          duração da marcação: o tempo ocupado é determinado pela duração de cada serviço.
        </p>
        {/* The other half of the booking grid lives on another page: this
            section sets when a marcação may start, Serviços sets how long
            each one occupies. Reachable from the bottom nav too — this is
            the contextual shortcut, right where the hint above raises it. */}
        <Link className="btn-ghost settings-section-link" to="/servicos">
          <Briefcase size={15} aria-hidden="true" />
          Gerir serviços e durações
        </Link>
      </section>

      <section className="settings-section">
        <p className="settings-section-title">
          <Clock size={13} aria-hidden="true" /> Horário de funcionamento
        </p>
        <p className="muted settings-hint settings-section-lead">
          Quando a empresa aceita marcações. Aplica-se a todas as semanas.
        </p>

        {WEEK.map(({ key, label }) => {
          const isOpen = hours?.[key]?.isOpen ?? false;
          const closeError = errors.hours?.[key]?.close;
          return (
            <div key={key} className={`settings-day-row${isOpen ? "" : " settings-day-row-closed"}`}>
              <div className="settings-day-main">
                <label className="settings-day-toggle">
                  <input type="checkbox" {...register(`hours.${key}.isOpen` as const)} />
                  <span>{label}</span>
                </label>
                {isOpen ? (
                  <div className="settings-day-times">
                    <input
                      type="time"
                      aria-label={`Hora de abertura — ${label}`}
                      aria-invalid={Boolean(closeError)}
                      {...register(`hours.${key}.open` as const, { required: true })}
                    />
                    <span aria-hidden="true">—</span>
                    <input
                      type="time"
                      aria-label={`Hora de fecho — ${label}`}
                      aria-invalid={Boolean(closeError)}
                      {...register(`hours.${key}.close` as const, {
                        required: true,
                        // Reads the sibling open time off the whole form value
                        // rather than a captured closure, so editing either
                        // input re-evaluates against the current other one.
                        validate: (v, values) =>
                          !values.hours[key].isOpen ||
                          v > values.hours[key].open ||
                          "A hora de fecho deve ser posterior à de abertura.",
                      })}
                    />
                  </div>
                ) : (
                  <span className="muted settings-day-closed">Encerrado</span>
                )}
              </div>
              {/* Next to the day it belongs to, not only in a toast — the
                  admin needs to see which of seven rows is wrong. */}
              {closeError && (
                <p className="settings-day-error" role="alert">
                  {closeError.message}
                </p>
              )}
            </div>
          );
        })}

        {/* Lunch break is opt-in — a business that never stops for lunch (or
            rotates staff through it) just leaves the checkbox off and the
            picker offers every slot straight through business_hours, exactly
            as if this feature didn't exist. */}
        <div className="settings-day-row settings-lunch-row">
          <label className="settings-day-toggle">
            <input type="checkbox" {...register("lunchBreakEnabled")} />
            <span>
              <Coffee size={13} aria-hidden="true" /> Hora de almoço
            </span>
          </label>

          {lunchBreakEnabled ? (
            <div className="settings-lunch-body">
              <label className="settings-lunch-apply-all">
                <input type="checkbox" {...register("lunchApplyToAll")} />
                <span>Aplicar o mesmo horário a todos os dias abertos</span>
              </label>

              {lunchApplyToAll ? (
                <>
                  <div className="settings-day-times">
                    <input
                      type="time"
                      aria-label="Início do almoço"
                      aria-invalid={Boolean(errors.lunchStart)}
                      {...register("lunchStart", {
                        required: true,
                        validate: (v, values) =>
                          !values.lunchBreakEnabled ||
                          !values.lunchApplyToAll ||
                          v < values.lunchEnd ||
                          "O início do almoço deve ser anterior ao fim.",
                      })}
                    />
                    <span aria-hidden="true">—</span>
                    <input
                      type="time"
                      aria-label="Fim do almoço"
                      aria-invalid={Boolean(errors.lunchEnd)}
                      {...register("lunchEnd", {
                        required: true,
                        validate: (v, values) =>
                          !values.lunchBreakEnabled ||
                          !values.lunchApplyToAll ||
                          v > values.lunchStart ||
                          "O fim do almoço deve ser posterior ao início.",
                      })}
                    />
                  </div>
                  {(errors.lunchStart || errors.lunchEnd) && (
                    <p className="settings-day-error" role="alert">
                      {errors.lunchStart?.message ?? errors.lunchEnd?.message}
                    </p>
                  )}
                </>
              ) : (
                // Granular mode: some tenants only break certain days (e.g.
                // Mon-Thu but continuous Fri/Sat) — only open days are listed,
                // since a closed day has no hours to break in the first place.
                <div className="settings-lunch-per-day">
                  {WEEK.filter(({ key }) => hours?.[key]?.isOpen).map(({ key, label }) => {
                    const d = hours[key];
                    const startError = errors.hours?.[key]?.lunchStart;
                    const endError = errors.hours?.[key]?.lunchEnd;
                    return (
                      <div key={key} className="settings-lunch-day-row">
                        <div className="settings-day-main">
                          <label className="settings-day-toggle settings-day-toggle-small">
                            <input type="checkbox" {...register(`hours.${key}.hasLunchBreak` as const)} />
                            <span>{label}</span>
                          </label>
                          {d.hasLunchBreak ? (
                            <div className="settings-day-times">
                              <input
                                type="time"
                                aria-label={`Início do almoço — ${label}`}
                                aria-invalid={Boolean(startError)}
                                {...register(`hours.${key}.lunchStart` as const, {
                                  required: true,
                                  validate: (v, values) => {
                                    const day = values.hours[key];
                                    if (values.lunchApplyToAll || !values.lunchBreakEnabled || !day.hasLunchBreak) return true;
                                    if (v < day.open) return "O almoço deve começar depois da abertura.";
                                    return v < day.lunchEnd || "O início do almoço deve ser anterior ao fim.";
                                  },
                                })}
                              />
                              <span aria-hidden="true">—</span>
                              <input
                                type="time"
                                aria-label={`Fim do almoço — ${label}`}
                                aria-invalid={Boolean(endError)}
                                {...register(`hours.${key}.lunchEnd` as const, {
                                  required: true,
                                  validate: (v, values) => {
                                    const day = values.hours[key];
                                    if (values.lunchApplyToAll || !values.lunchBreakEnabled || !day.hasLunchBreak) return true;
                                    if (v > day.close) return "O almoço deve terminar antes do fecho.";
                                    return v > day.lunchStart || "O fim do almoço deve ser posterior ao início.";
                                  },
                                })}
                              />
                            </div>
                          ) : (
                            <span className="muted settings-day-closed">Sem pausa</span>
                          )}
                        </div>
                        {(startError || endError) && (
                          <p className="settings-day-error" role="alert">
                            {startError?.message ?? endError?.message}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="muted settings-hint settings-lunch-hint">
              Sem pausa de almoço definida. As marcações serão contínuas durante o horário de funcionamento.
            </p>
          )}
        </div>
      </section>

      {/* Sticky rather than a plain button at the end of the page: the hours
          list is long enough that a change made at the top would otherwise
          scroll its own Save action out of sight. Also the in-app guard —
          the bar is what tells the admin there is something unsaved. */}
      <div className={`settings-savebar${isDirty ? " settings-savebar-dirty" : ""}`}>
        <span className="muted">
          {updateCompany.isPending ? "A guardar…" : isDirty ? "Existem alterações por guardar." : "Tudo guardado."}
        </span>
        <div className="settings-savebar-actions">
          {isDirty && !updateCompany.isPending && (
            <Button variant="ghost" onClick={() => reset()}>
              Descartar
            </Button>
          )}
          <Button type="submit" disabled={!isDirty || updateCompany.isPending}>
            <Save size={16} aria-hidden="true" />
            {updateCompany.isPending ? "A guardar…" : "Guardar alterações"}
          </Button>
        </div>
      </div>
    </form>
  );
}
