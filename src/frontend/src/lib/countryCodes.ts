// ISO 3166-1 alpha-2 + E.164 calling code, for the phone-entry country picker
// (NewCustomerForm, CustomerEditModal, PublicBookingPage). `iso2` is sent to
// the backend as CustomerCreate/CustomerUpdate/PublicBookingCreate's
// `country` field — it's the region `phonenumbers.parse` falls back to when
// the typed number has no leading "+" (see backend core/phone.py::to_e164).
// `dialCode` is display-only, so the dropdown can show "+351" next to the
// flag instead of making someone recognize a country by name alone. Not
// every ISO 3166-1 territory is listed — this covers the countries this
// business realistically has customers in; add more as they come up.
//
// `examplePlaceholder` is cosmetic only — national mobile-number length
// varies a lot by country (Denmark is 8 digits, Portugal/Spain 9, the UK/US/
// Brazil 10-11), so a single fixed placeholder ("912 345 678" for every
// country, left over from when this app was PT-only) actively misled staff
// into thinking every country needs 9 digits. These examples are plausible
// shapes, not real assigned numbers, and aren't validated against — the
// actual check is `phonenumbers`, on the backend, against the selected
// country's real numbering plan (see core/phone.py::to_e164), so a correct
// number in a different shape than its placeholder still submits fine.
export interface CountryCode {
  iso2: string;
  dialCode: string;
  name: string;
  examplePlaceholder: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { iso2: "PT", dialCode: "+351", name: "Portugal", examplePlaceholder: "912 345 678" },
  { iso2: "ES", dialCode: "+34", name: "Espanha", examplePlaceholder: "612 345 678" },
  { iso2: "FR", dialCode: "+33", name: "França", examplePlaceholder: "6 12 34 56 78" },
  { iso2: "GB", dialCode: "+44", name: "Reino Unido", examplePlaceholder: "7911 123456" },
  { iso2: "DE", dialCode: "+49", name: "Alemanha", examplePlaceholder: "151 23456789" },
  { iso2: "IT", dialCode: "+39", name: "Itália", examplePlaceholder: "312 345 6789" },
  { iso2: "NL", dialCode: "+31", name: "Países Baixos", examplePlaceholder: "6 12345678" },
  { iso2: "BE", dialCode: "+32", name: "Bélgica", examplePlaceholder: "470 12 34 56" },
  { iso2: "CH", dialCode: "+41", name: "Suíça", examplePlaceholder: "78 123 45 67" },
  { iso2: "IE", dialCode: "+353", name: "Irlanda", examplePlaceholder: "85 123 4567" },
  { iso2: "LU", dialCode: "+352", name: "Luxemburgo", examplePlaceholder: "621 123 456" },
  { iso2: "AT", dialCode: "+43", name: "Áustria", examplePlaceholder: "664 123456" },
  { iso2: "SE", dialCode: "+46", name: "Suécia", examplePlaceholder: "70 123 45 67" },
  { iso2: "NO", dialCode: "+47", name: "Noruega", examplePlaceholder: "406 12 345" },
  { iso2: "DK", dialCode: "+45", name: "Dinamarca", examplePlaceholder: "20 12 34 56" },
  { iso2: "FI", dialCode: "+358", name: "Finlândia", examplePlaceholder: "41 234 5678" },
  { iso2: "PL", dialCode: "+48", name: "Polónia", examplePlaceholder: "512 345 678" },
  { iso2: "RO", dialCode: "+40", name: "Roménia", examplePlaceholder: "712 345 678" },
  { iso2: "GR", dialCode: "+30", name: "Grécia", examplePlaceholder: "691 234 5678" },
  { iso2: "CZ", dialCode: "+420", name: "República Checa", examplePlaceholder: "601 123 456" },
  { iso2: "HU", dialCode: "+36", name: "Hungria", examplePlaceholder: "20 123 4567" },
  { iso2: "UA", dialCode: "+380", name: "Ucrânia", examplePlaceholder: "50 123 4567" },
  { iso2: "RU", dialCode: "+7", name: "Rússia", examplePlaceholder: "912 345 67 89" },
  { iso2: "TR", dialCode: "+90", name: "Turquia", examplePlaceholder: "501 234 5678" },
  { iso2: "MA", dialCode: "+212", name: "Marrocos", examplePlaceholder: "612 345 678" },
  { iso2: "DZ", dialCode: "+213", name: "Argélia", examplePlaceholder: "551 23 45 67" },
  { iso2: "TN", dialCode: "+216", name: "Tunísia", examplePlaceholder: "20 123 456" },
  { iso2: "CV", dialCode: "+238", name: "Cabo Verde", examplePlaceholder: "991 23 45" },
  { iso2: "AO", dialCode: "+244", name: "Angola", examplePlaceholder: "923 123 456" },
  { iso2: "MZ", dialCode: "+258", name: "Moçambique", examplePlaceholder: "82 123 4567" },
  { iso2: "GW", dialCode: "+245", name: "Guiné-Bissau", examplePlaceholder: "955 012 345" },
  { iso2: "ST", dialCode: "+239", name: "São Tomé e Príncipe", examplePlaceholder: "981 2345" },
  { iso2: "ZA", dialCode: "+27", name: "África do Sul", examplePlaceholder: "71 123 4567" },
  { iso2: "NG", dialCode: "+234", name: "Nigéria", examplePlaceholder: "802 123 4567" },
  { iso2: "EG", dialCode: "+20", name: "Egito", examplePlaceholder: "100 123 4567" },
  { iso2: "BR", dialCode: "+55", name: "Brasil", examplePlaceholder: "11 91234 5678" },
  { iso2: "US", dialCode: "+1", name: "Estados Unidos", examplePlaceholder: "415 555 0132" },
  { iso2: "CA", dialCode: "+1", name: "Canadá", examplePlaceholder: "416 555 0132" },
  { iso2: "MX", dialCode: "+52", name: "México", examplePlaceholder: "55 1234 5678" },
  { iso2: "AR", dialCode: "+54", name: "Argentina", examplePlaceholder: "11 2345 6789" },
  { iso2: "CL", dialCode: "+56", name: "Chile", examplePlaceholder: "9 6123 4567" },
  { iso2: "CO", dialCode: "+57", name: "Colômbia", examplePlaceholder: "300 123 4567" },
  { iso2: "PE", dialCode: "+51", name: "Peru", examplePlaceholder: "912 345 678" },
  { iso2: "VE", dialCode: "+58", name: "Venezuela", examplePlaceholder: "412 123 4567" },
  { iso2: "UY", dialCode: "+598", name: "Uruguai", examplePlaceholder: "94 231 234" },
  { iso2: "CN", dialCode: "+86", name: "China", examplePlaceholder: "138 0013 8000" },
  { iso2: "JP", dialCode: "+81", name: "Japão", examplePlaceholder: "90 1234 5678" },
  { iso2: "KR", dialCode: "+82", name: "Coreia do Sul", examplePlaceholder: "10 1234 5678" },
  { iso2: "IN", dialCode: "+91", name: "Índia", examplePlaceholder: "98765 43210" },
  { iso2: "PK", dialCode: "+92", name: "Paquistão", examplePlaceholder: "300 1234567" },
  { iso2: "BD", dialCode: "+880", name: "Bangladeche", examplePlaceholder: "1712 345678" },
  { iso2: "ID", dialCode: "+62", name: "Indonésia", examplePlaceholder: "812 345 6789" },
  { iso2: "PH", dialCode: "+63", name: "Filipinas", examplePlaceholder: "917 123 4567" },
  { iso2: "VN", dialCode: "+84", name: "Vietname", examplePlaceholder: "91 234 56 78" },
  { iso2: "TH", dialCode: "+66", name: "Tailândia", examplePlaceholder: "81 234 5678" },
  { iso2: "MY", dialCode: "+60", name: "Malásia", examplePlaceholder: "12 345 6789" },
  { iso2: "SG", dialCode: "+65", name: "Singapura", examplePlaceholder: "8123 4567" },
  { iso2: "AE", dialCode: "+971", name: "Emirados Árabes Unidos", examplePlaceholder: "50 123 4567" },
  { iso2: "SA", dialCode: "+966", name: "Arábia Saudita", examplePlaceholder: "50 123 4567" },
  { iso2: "IL", dialCode: "+972", name: "Israel", examplePlaceholder: "50 123 4567" },
  { iso2: "AU", dialCode: "+61", name: "Austrália", examplePlaceholder: "412 345 678" },
  { iso2: "NZ", dialCode: "+64", name: "Nova Zelândia", examplePlaceholder: "21 123 4567" },
];

const DEFAULT_PLACEHOLDER = "Número de telemóvel";

export function phonePlaceholderFor(iso2: string): string {
  return COUNTRY_CODES.find((c) => c.iso2 === iso2)?.examplePlaceholder ?? DEFAULT_PLACEHOLDER;
}

// Longest dial code first, so a 3-digit code (e.g. "+351") is tried before
// any shorter code that happens to share its leading digit(s) — otherwise a
// wrong, shorter match could steal digits that actually belong to the
// national number.
const BY_DIAL_CODE_LENGTH_DESC = [...COUNTRY_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length);

// Splits a stored E.164 number ("+5585989580681") into its dial code,
// country, and national number ("+55", "BR", "85989580681") — used both for
// read-only display (lib/format.ts::formatStoredPhone) and to preselect the
// right flag when opening CustomerEditModal for editing, instead of always
// defaulting to "PT" and leaving the dial code duplicated between the picker
// and the phone field. Only recognizes the dial codes in COUNTRY_CODES above
// (not the full ITU set) — returns null for an unlisted country's number, so
// callers fall back to their own PT-default behaviour.
export function splitE164(phone: string): { dialCode: string; iso2: string; national: string } | null {
  const digits = phone.replace(/\D/g, "");
  for (const c of BY_DIAL_CODE_LENGTH_DESC) {
    const codeDigits = c.dialCode.slice(1);
    if (digits.startsWith(codeDigits)) {
      return { dialCode: c.dialCode, iso2: c.iso2, national: digits.slice(codeDigits.length) };
    }
  }
  return null;
}
