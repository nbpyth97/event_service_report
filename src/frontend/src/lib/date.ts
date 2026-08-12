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
