import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AgendamentoList from "@/components/AgendamentoList";
import CalendarView from "@/components/CalendarView";
import AgendamentoDateRangePicker, { computePresetRange } from "@/components/AgendamentoDateRangePicker";
import type { DatePreset, DateRange } from "@/components/AgendamentoDateRangePicker";
import SearchFilterInput from "@/components/SearchFilterInput";
import AgendamentoStatusTabs, { matchesStatusFilter } from "@/components/AgendamentoStatusTabs";
import type { StatusFilterKey } from "@/components/AgendamentoStatusTabs";
import { useAgendamentos, useMyCompany } from "@/hooks/queries";
import { zonedDateStr } from "@/lib/tz";

type Mode = "overview" | "calendar";

const STATUS_ADJECTIVE: Record<StatusFilterKey, string> = {
  pending: "pendentes",
  confirmed: "confirmados",
  declined: "recusados",
};

// "pendentes", "pendentes e confirmados", "pendentes, confirmados e recusados"
function joinAdjectives(keys: StatusFilterKey[]): string {
  const words = keys.map((k) => STATUS_ADJECTIVE[k]);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0];
  return `${words.slice(0, -1).join(", ")} e ${words[words.length - 1]}`;
}

const PERIOD_PHRASE: Record<DatePreset, string> = {
  today: "hoje",
  week: "esta semana",
  month: "este mês",
  all: "",
  custom: "no período selecionado",
};

export default function AgendamentosPage() {
  const { data: agendamentos, isLoading } = useAgendamentos();
  const { data: company } = useMyCompany();

  const [mode, setMode] = useState<Mode>("overview");
  const [selectedStatuses, setSelectedStatuses] = useState<StatusFilterKey[]>(["confirmed"]);
  const [datePreset, setDatePreset] = useState<DatePreset>("week");
  const [dateRange, setDateRange] = useState<DateRange>(() => computePresetRange("week"));
  const [personQuery, setPersonQuery] = useState("");
  // Set only by the deep-link effect below, from a specific customer's card
  // — customer_known_name has no uniqueness constraint (see core/models.py),
  // so two customers can share a name, and filtering the list by that name
  // as plain text would silently mix their bookings together. An exact
  // customer_id match is what actually scopes to "this one customer";
  // personQuery stays the free-text substring search for manual typing.
  // Any manual edit to the search box (see the SearchFilterInput below)
  // clears this back to null, handing filtering back to the text search.
  const [personCustomerId, setPersonCustomerId] = useState<string | null>(null);
  const [defaultsReady, setDefaultsReady] = useState(false);
  const defaultsApplied = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightRequest = searchParams.get("highlight");
  const personRequest = searchParams.get("person");
  const personIdRequest = searchParams.get("personId");

  const pendingCount = agendamentos?.filter((a) => a.status === "pending").length ?? 0;

  // Deep link from a notification/reminder click: force whatever filters are
  // needed so the target booking is actually visible, then strip the query
  // param (the local highlightedId state is what keeps the border/scroll
  // alive from here on, not the URL). Runs independently of the one-time
  // smart-default effect below so it also fires for a second click while
  // already on this page. Declared first so its defaultsApplied.current
  // write (when a highlight is requested at first mount) wins the race
  // against the smart-default effect in the same commit.
  useEffect(() => {
    if (!highlightRequest || !agendamentos) return;
    const target = agendamentos.find((a) => a.id === highlightRequest);
    if (target) {
      setMode("overview");
      const key: StatusFilterKey = target.status === "cancelled" ? "declined" : (target.status as StatusFilterKey);
      setSelectedStatuses((prev) => (prev.includes(key) ? prev : [...prev, key]));
      setDatePreset("all");
      setDateRange(computePresetRange("all"));
      setHighlightedId(target.id);
    }
    defaultsApplied.current = true;
    setDefaultsReady(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("highlight");
        return next;
      },
      { replace: true }
    );
  }, [highlightRequest, agendamentos, setSearchParams]);

  // Deep link from CustomersPage's "N marcações" — show that customer's
  // bookings across every status (no smart-default narrowing), pre-filled
  // into the same person search used for manual typing, scoped to "esta
  // semana" by default like any other fresh visit to this page. Doesn't
  // need to wait on `agendamentos` (unlike the highlight effect above) since
  // it's just seeding text-filter state, not looking up a specific booking.
  useEffect(() => {
    if (!personRequest) return;
    setMode("overview");
    setPersonQuery(personRequest);
    // personId scopes the filter to this exact customer (see
    // personCustomerId's declaration above) — personRequest alone only
    // seeds the search box's displayed text.
    setPersonCustomerId(personIdRequest);
    setSelectedStatuses([]);
    setDatePreset("week");
    setDateRange(computePresetRange("week"));
    defaultsApplied.current = true;
    setDefaultsReady(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("person");
        next.delete("personId");
        return next;
      },
      { replace: true }
    );
  }, [personRequest, personIdRequest, setSearchParams]);

  // Smart first-load default: open straight to what needs a decision. If
  // there's nothing pending, "esta semana" of confirmed bookings is the more
  // useful starting point than an unfiltered "Todos". Only ever runs once —
  // after that, the provider's own choices take over.
  //
  // The render gate below stays on "Carregando…" until defaultsReady flips,
  // so the very first frame that shows real cards already reflects the
  // corrected filter — without it, agendamentos arriving flips isLoading to
  // false one render before this effect can apply the pending-first default,
  // and that single frame briefly renders with the stale ["confirmed"] state.
  useEffect(() => {
    if (defaultsApplied.current || !agendamentos) return;
    defaultsApplied.current = true;
    if (pendingCount > 0) {
      setSelectedStatuses(["pending"]);
      setDatePreset("all");
      setDateRange(computePresetRange("all"));
    }
    setDefaultsReady(true);
  }, [agendamentos, pendingCount]);

  const toggleStatus = (key: StatusFilterKey) => {
    setSelectedStatuses((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  // Overview mode — date range + person filter apply first, feeding both the
  // status-tab counts and the final filtered list.
  const dateAndPersonFiltered = useMemo(() => {
    let list = agendamentos ?? [];
    if (personCustomerId) {
      list = list.filter((a) => a.customer_id === personCustomerId);
    } else if (personQuery.trim()) {
      const q = personQuery.trim().toLowerCase();
      list = list.filter((a) => a.customer_known_name.toLowerCase().includes(q));
    }
    if (dateRange.start) {
      list = list.filter((a) => zonedDateStr(a.start_time) >= dateRange.start);
    }
    if (dateRange.end) {
      list = list.filter((a) => zonedDateStr(a.start_time) <= dateRange.end);
    }
    return list;
  }, [agendamentos, personQuery, personCustomerId, dateRange]);

  const overviewVisible = dateAndPersonFiltered.filter((a) => matchesStatusFilter(a, selectedStatuses));
  const filtersActive = Boolean(
    dateRange.start || dateRange.end || personQuery.trim() || personCustomerId || selectedStatuses.length > 0
  );

  const statusAdjective = joinAdjectives(selectedStatuses);
  const summaryText = `${overviewVisible.length} agendamento${overviewVisible.length === 1 ? "" : "s"}${
    statusAdjective ? ` ${statusAdjective}` : ""
  }${PERIOD_PHRASE[datePreset] ? ` ${PERIOD_PHRASE[datePreset]}` : ""}`;

  return (
    <div className="page">
      <div className="agendamento-mode-switch" role="tablist" aria-label="Modo de visualização">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "calendar"}
          className={mode === "calendar" ? "active" : ""}
          onClick={() => setMode("calendar")}
        >
          Calendário
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "overview"}
          className={mode === "overview" ? "active" : ""}
          onClick={() => setMode("overview")}
        >
          Visão geral
        </button>
      </div>

      {isLoading || !defaultsReady ? (
        <p>Carregando…</p>
      ) : mode === "calendar" && company ? (
        <CalendarView
          agendamentos={agendamentos ?? []}
          businessHours={company.settings.business_hours}
          highlightedId={highlightedId}
        />
      ) : (
        <>
          <AgendamentoDateRangePicker
            preset={datePreset}
            range={dateRange}
            onPresetChange={setDatePreset}
            onRangeChange={setDateRange}
          />
          <SearchFilterInput
            value={personQuery}
            onChange={(v) => {
              setPersonQuery(v);
              // A manual edit hands filtering back to the free-text
              // substring search — see personCustomerId's declaration above.
              setPersonCustomerId(null);
            }}
            placeholder="Filtrar por cliente…"
            ariaLabel="Filtrar por cliente"
          />
          <AgendamentoStatusTabs agendamentos={dateAndPersonFiltered} selected={selectedStatuses} onToggle={toggleStatus} />
          <p className="agendamento-overview-summary">{summaryText}</p>
          <AgendamentoList
            agendamentos={overviewVisible}
            emptyMessage={
              filtersActive && (agendamentos?.length ?? 0) > 0
                ? "Nenhuma marcação encontrada para estes filtros."
                : undefined
            }
            highlightedId={highlightedId}
          />
        </>
      )}
    </div>
  );
}
