export const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DowKey = (typeof DOW_KEYS)[number];

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dowKeyOf(d: Date): DowKey {
  return DOW_KEYS[d.getDay()];
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

// Monday-first week, matching how the booking calendar and date-range
// presets both read a "week" — Sunday is the tail end, not the start.
export function startOfWeek(d: Date): Date {
  const day = d.getDay();
  return addDays(d, day === 0 ? -6 : 1 - day);
}

// "Hoje" / "Amanhã" read faster than a weekday name when scanning a
// schedule — full weekday+day+month only once the date is further out.
export function fmtDateHeading(d: Date): string {
  const dStr = toDateStr(d);
  if (dStr === toDateStr(new Date())) return "Hoje";
  if (dStr === toDateStr(addDays(new Date(), 1))) return "Amanhã";
  return d.toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long" });
}
