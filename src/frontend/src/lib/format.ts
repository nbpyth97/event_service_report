import { getDisplayTimeZone, zonedParts } from "@/lib/tz";
import { splitE164 } from "@/lib/countryCodes";

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

// Customers aren't Portugal-only, so there's no fixed digit count to format
// or validate against — these bounds are the E.164 standard's own shape
// (country calling code + national number, 8-15 digits total). Real parsing/
// validation happens on the backend via `phonenumbers` (core/phone.py::
// to_e164) — this is just a client-side sanity range, not the source of
// truth (the public booking endpoint is unauthenticated, so backend
// validation is the actual enforcement either way).
const PHONE_MIN_DIGITS = 8;
const PHONE_MAX_DIGITS = 15;

// As-you-type phone formatting. Deliberately does NOT group the digits —
// grouping every country's number in 3s ("222 222 222 222 222") is flat-out
// wrong for most countries (the per-country example placeholder next to it
// might read "41 234 5678", a 2-4-4 split) and a wrong-but-confident-looking
// grouping is worse than none: it looks like a format hint when it isn't
// one. A leading "+" is preserved verbatim rather than stripped with the
// rest of the punctuation: the stored value is always "+"-prefixed E.164
// (backend core/phone.py::to_e164), and keeping it visible is what makes an
// unedited stored number round-trip correctly on re-save — an explicit "+"
// tells the backend to ignore whatever country the picker happens to be on
// (see CustomerEditModal.tsx, which has no way to know a customer's original
// country and always defaults the picker to "PT"). No masking library is
// installed — this only reformats digits already typed, it never blocks
// input, but it does truncate at PHONE_MAX_DIGITS, since unbounded input
// isn't "graceful," it's just a bad payload waiting to happen.
export function formatPhoneDisplay(raw: string): string {
  const hasLeadingPlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "").slice(0, PHONE_MAX_DIGITS);
  if (!digits) return hasLeadingPlus ? "+" : "";
  return hasLeadingPlus ? `+${digits}` : digits;
}

// Read-only display of a *stored* (already-canonical E.164) phone number —
// see CustomerRow.tsx. Separates the dial code from the national number
// (via lib/countryCodes.ts::splitE164) instead of blindly chunking every
// digit in the string into groups of 3, which mangles the boundary between
// them for any dial code that isn't itself a multiple of 3 digits (e.g. a
// 2-digit code like "+55" splits mid-group: "+558 598 958 068 1"). The
// national number is left as one block rather than re-grouped, since we
// don't know that country's own grouping convention — just its length.
export function formatStoredPhone(phone: string): string {
  const split = splitE164(phone);
  if (split) return `${split.dialCode} ${split.national}`;
  const digits = phone.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

// react-hook-form validate rule for a phone field formatted with
// formatPhoneDisplay — digit count only (formatting/spacing is cosmetic),
// bounded by what any real E.164 number can be, not a single country's
// shape. Returns an error message string, or true when valid, matching
// RHF's `validate` contract.
export function validatePhone(value: string): string | true {
  const digits = value.replace(/\D/g, "");
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) {
    return "Indique o número completo, com o indicativo do país (ex.: 351 912 345 678).";
  }
  return true;
}
