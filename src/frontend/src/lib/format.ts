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

// This app is Portugal-only (single pilot tenant, every placeholder already
// assumes "+351 9XX XXX XXX") — 351 + 9-digit mobile number = 12 digits is
// the real ceiling, not E.164's generic 15. The old 15-digit cap left room
// for a whole extra 3-digit group past a valid PT number before either
// formatPhonePT or validatePhoneDigits would stop it.
const MAX_PHONE_DIGITS = 12;
const MIN_PHONE_DIGITS = 9;

// As-you-type phone formatting, grouped in the "+351 912 345 678" shape the
// app already used as a placeholder. No masking library is installed — this
// only reformats digits already typed, it never blocks input, so it degrades
// gracefully for numbers that don't fit the PT mobile pattern (a longer/
// shorter/non-PT number still just gets grouped in 3s after the prefix) —
// but it does truncate at MAX_PHONE_DIGITS, since unbounded input isn't
// "graceful," it's just a bad payload waiting to happen.
export function formatPhonePT(raw: string): string {
  const hasPlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "").slice(0, MAX_PHONE_DIGITS);
  if (!digits) return hasPlus ? "+" : "";

  let countryCode = "";
  let rest = digits;
  if (hasPlus) {
    // +351 (or another 2-3 digit country code) followed by the subscriber
    // number — split it off so the number itself still groups in 3s.
    countryCode = digits.slice(0, 3);
    rest = digits.slice(3);
  }

  const groups = rest.match(/.{1,3}/g) ?? [];
  const number = groups.join(" ");
  return hasPlus ? `+${countryCode}${number ? ` ${number}` : ""}` : number;
}

// react-hook-form validate rule for a phone field formatted with
// formatPhonePT — digit count only (formatting/spacing is cosmetic), bounded
// to what a real phone number can be. Returns an error message string, or
// true when valid, matching RHF's `validate` contract.
export function validatePhoneDigits(value: string): string | true {
  const digits = value.replace(/\D/g, "");
  if (digits.length < MIN_PHONE_DIGITS) return "Telemóvel demasiado curto.";
  if (digits.length > MAX_PHONE_DIGITS) return "Telemóvel demasiado longo.";
  return true;
}

// Local-only display form — "924 232 323", no country code. Portuguese
// mobile numbers are 9 digits, so the last 9 digits are the local number
// regardless of whether the stored value carries a "+351" prefix; reuses
// formatPhonePT's own grouping (called with no "+", it groups digits in 3s)
// rather than re-implementing it.
export function fmtPhoneLocalPT(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return formatPhonePT(digits.slice(-9));
}
