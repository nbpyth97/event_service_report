import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AgendamentoList from "@/components/AgendamentoList";
import DayTimeline from "@/components/DayTimeline";
import AgendamentoDateRangePicker, { computePresetRange } from "@/components/AgendamentoDateRangePicker";
import type { DatePreset, DateRange } from "@/components/AgendamentoDateRangePicker";
import AgendamentoSearch from "@/components/AgendamentoSearch";
import AgendamentoStatusTabs, { matchesStatusFilter } from "@/components/AgendamentoStatusTabs";
import type { StatusFilterKey } from "@/components/AgendamentoStatusTabs";
import { useCurrentUser } from "@/auth/user";
import { useAgendamentos, useMyCompany } from "@/hooks/queries";
import { toDateStr } from "@/lib/date";

type Mode = "overview" | "day";

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
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const { data: agendamentos, isLoading } = useAgendamentos();
  const { data: company } = useMyCompany();

  const [mode, setMode] = useState<Mode>("overview");
  const [timelineDate, setTimelineDate] = useState(() => new Date());
  const [selectedStatuses, setSelectedStatuses] = useState<StatusFilterKey[]>(["confirmed"]);
  const [datePreset, setDatePreset] = useState<DatePreset>("week");
  const [dateRange, setDateRange] = useState<DateRange>(() => computePresetRange("week"));
  const [personQuery, setPersonQuery] = useState("");
  const [defaultsReady, setDefaultsReady] = useState(false);
  const defaultsApplied = useRef(false);

  const pendingCount = agendamentos?.filter((a) => a.status === "pending").length ?? 0;

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

  // Day mode — unchanged: admins browse by day, pending requests always stay
  // visible so browsing forward never hides something still waiting on a
  // decision.
  const timelineDateStr = toDateStr(timelineDate);
  const dayVisible =
    isAdmin && agendamentos
      ? agendamentos.filter(
          (a) => a.status === "pending" || toDateStr(new Date(a.start_time)) === timelineDateStr
        )
      : agendamentos;

  // Overview mode — date range + (admin) person filter apply first, feeding
  // both the status-tab counts and the final filtered list.
  const dateAndPersonFiltered = useMemo(() => {
    let list = agendamentos ?? [];
    if (isAdmin && personQuery.trim()) {
      const q = personQuery.trim().toLowerCase();
      list = list.filter((a) => a.customer_name.toLowerCase().includes(q));
    }
    if (dateRange.start) {
      list = list.filter((a) => toDateStr(new Date(a.start_time)) >= dateRange.start);
    }
    if (dateRange.end) {
      list = list.filter((a) => toDateStr(new Date(a.start_time)) <= dateRange.end);
    }
    return list;
  }, [agendamentos, isAdmin, personQuery, dateRange]);

  const overviewVisible = dateAndPersonFiltered.filter((a) => matchesStatusFilter(a, selectedStatuses));
  const filtersActive = Boolean(dateRange.start || dateRange.end || personQuery.trim() || selectedStatuses.length > 0);

  const statusAdjective = joinAdjectives(selectedStatuses);
  const summaryText = `${overviewVisible.length} agendamento${overviewVisible.length === 1 ? "" : "s"}${
    statusAdjective ? ` ${statusAdjective}` : ""
  }${PERIOD_PHRASE[datePreset] ? ` ${PERIOD_PHRASE[datePreset]}` : ""}`;

  return (
    <div className="page">
      <div className="page-header-row">
        {!isAdmin && (
          <Link to="/services" className="agendamentos-new-link">
            + Nova marcação
          </Link>
        )}
      </div>

      {isAdmin && (
        <div className="agendamento-mode-switch" role="tablist" aria-label="Modo de visualização">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "overview"}
            className={mode === "overview" ? "active" : ""}
            onClick={() => setMode("overview")}
          >
            Visão geral
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "day"}
            className={mode === "day" ? "active" : ""}
            onClick={() => setMode("day")}
          >
            Por dia
          </button>
        </div>
      )}

      {isLoading || !defaultsReady ? (
        <p>Carregando…</p>
      ) : mode === "day" && isAdmin && company ? (
        <>
          <DayTimeline
            businessHours={company.settings.business_hours}
            agendamentos={agendamentos ?? []}
            date={timelineDate}
            onDateChange={setTimelineDate}
          />
          <AgendamentoList
            agendamentos={dayVisible ?? []}
            emptyMessage={(agendamentos?.length ?? 0) > 0 ? "Nenhuma marcação neste dia." : undefined}
          />
        </>
      ) : (
        <>
          <AgendamentoDateRangePicker
            preset={datePreset}
            range={dateRange}
            onPresetChange={setDatePreset}
            onRangeChange={setDateRange}
          />
          {isAdmin && <AgendamentoSearch value={personQuery} onChange={setPersonQuery} />}
          <AgendamentoStatusTabs agendamentos={dateAndPersonFiltered} selected={selectedStatuses} onToggle={toggleStatus} />
          <p className="agendamento-overview-summary">{summaryText}</p>
          <AgendamentoList
            agendamentos={overviewVisible}
            emptyMessage={
              filtersActive && (agendamentos?.length ?? 0) > 0
                ? "Nenhuma marcação encontrada para estes filtros."
                : undefined
            }
          />
        </>
      )}
    </div>
  );
}
