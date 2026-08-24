// Every instant the API returns is a real moment in time carrying the
// company's own offset (availability/service.py builds slots with ZoneInfo).
// Rendering one with a bare `new Date(iso).toLocaleTimeString()` re-expresses
// it in *the viewer's* zone — so a customer booking from São Paulo sees "04:00"
// on a button that will actually book 08:00 at the salon. The instant posted
// back is still correct; only the label lies, which is the worse failure mode.
//
// So display zone is a single app-wide setting, exactly like the "pt-PT" locale
// already hardcoded across these formatters: set once from Company.settings
// (or the public endpoint's timezone) and read by every date/time formatter.
// Left undefined until the company loads, which falls back to browser-local —
// i.e. the previous behaviour, never a crash.
let displayTimeZone: string | undefined;

export function setDisplayTimeZone(tz: string | undefined): void {
  if (tz && tz !== displayTimeZone) {
    displayTimeZone = tz;
    partsFormatters.clear();
  }
}

export function getDisplayTimeZone(): string | undefined {
  return displayTimeZone;
}

export interface ZonedParts {
  year: number;
  month: number; // 1-12, not the 0-11 Date uses
  day: number;
  hour: number;
  minute: number;
}

// Intl.DateTimeFormat construction is the expensive part, and these run once
// per rendered row in the agenda and calendar grids.
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(): Intl.DateTimeFormat {
  const key = displayTimeZone ?? "";
  let fmt = partsFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: displayTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23", // h23 not hour12:false — the latter still yields "24" at midnight
    });
    partsFormatters.set(key, fmt);
  }
  return fmt;
}

// Calendar fields of an instant *as seen in the display zone*. Needed wherever
// a Date's own getHours/getDate would silently answer in browser-local time.
export function zonedParts(value: string | Date): ZonedParts {
  const parts = partsFormatter().formatToParts(typeof value === "string" ? new Date(value) : value);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

// "2026-09-01" for an instant — the day-bucket key used to group agendamentos
// into calendar cells and day headings. The zoned counterpart of
// lib/date.ts::toDateStr, which takes a Date already standing for a local day.
export function zonedDateStr(value: string | Date): string {
  const { year, month, day } = zonedParts(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Minutes since midnight in the display zone — for positioning blocks on the
// day/week grid and for splitting the slot picker into Manhã/Tarde.
export function zonedMinutesOfDay(value: string | Date): number {
  const { hour, minute } = zonedParts(value);
  return hour * 60 + minute;
}
