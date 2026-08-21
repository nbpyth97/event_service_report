import { getDisplayTimeZone, zonedParts } from "@/lib/tz";

export function fmtPrice(price: string | number): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Number(price));
}

// Digits only, no "€" — for rows that already pair the value with a
// currency icon, where the symbol would be redundant.
export function fmtPriceValue(price: string | number): string {
  return new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(price));
}

export function fmtDateTime(iso: string): string {
  const formatted = new Date(iso).toLocaleString("pt-PT", {
    timeZone: getDisplayTimeZone(),
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  // pt-PT lowercases weekday abbreviations ("sáb.") — capitalize for
  // sentence-style formality when this leads a line ("Sábado, 15/08...").
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-PT", {
    timeZone: getDisplayTimeZone(),
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "28/05 14:32" — for status-history timestamps, where a bare HH:MM would be
// ambiguous once an appointment's transitions span more than one day.
export function fmtShortDateTime(iso: string): string {
  const { day, month, hour, minute } = zonedParts(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(day)}/${pad(month)} ${pad(hour)}:${pad(minute)}`;
}

// This app is Portugal-only (single pilot tenant) — exactly 351 + a 9-digit
// mobile number = 12 digits, no more, no less. A fixed length (not a 9-12
// range) means there's only one way to type a given number, so two spellings
// of the same phone can't normalize to two different stored values and
// silently split one customer into two rows (see backend
// domains/customers/service.py::normalize_phone). No "+": it reads as noise,
// not help — the placeholder ("351 912 345 678") is what teaches the format.
const PHONE_DIGITS = 12;

// As-you-type phone formatting, grouped as "351 912 345 678" — the first 3
// digits typed are always treated as the country code, matching the
// placeholder. No masking library is installed — this only reformats digits
// already typed, it never blocks input, but it does truncate at
// PHONE_DIGITS, since unbounded input isn't "graceful," it's just a bad
// payload waiting to happen.
export function formatPhonePT(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, PHONE_DIGITS);
  if (!digits) return "";

  const countryCode = digits.slice(0, 3);
  const rest = digits.slice(3);
  const groups = rest.match(/.{1,3}/g) ?? [];
  return [countryCode, ...groups].join(" ");
}

// react-hook-form validate rule for a phone field formatted with
// formatPhonePT — digit count only (formatting/spacing is cosmetic), fixed
// to what a real PT number is. Returns an error message string, or true when
// valid, matching RHF's `validate` contract.
export function validatePhoneDigits(value: string): string | true {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== PHONE_DIGITS) return "Indique o número completo, com o indicativo (ex.: 351 912 345 678).";
  return true;
}

// Local-only display form — "924 232 323", no country code. Portuguese
// mobile numbers are 9 digits, so the last 9 digits are the local number
// regardless of the stored value's exact prefix; reuses formatPhonePT's own
// 3-digit grouping rather than re-implementing it.
export function fmtPhoneLocalPT(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return formatPhonePT(digits.slice(-9));
}
