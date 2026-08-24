import { ChevronDown } from "lucide-react";
import { COUNTRY_CODES } from "@/lib/countryCodes";

// Flag + dial-code picker for phone-entry forms (NewCustomerForm,
// CustomerEditModal, PublicBookingPage). The real <select> is kept for free
// keyboard/screen-reader support and the native mobile picker UI (which
// lists every country's full name — that's still there), but made invisible
// and stacked over a compact "flag + dial code" trigger instead of letting
// the browser render its own closed-state box: a closed <select> always
// shows the selected <option>'s full text ("Portugal (+351)"), which on a
// narrow phone screen ate most of the row and squeezed the phone number
// input down to a sliver. No masking library, no custom dropdown/positioning
// logic — tapping anywhere in this box still opens the browser's own
// picker, just with a much smaller closed footprint. Flags are local SVGs
// (public/flags, copied from the flag-icons package at build time) rather
// than a CDN or emoji: emoji flags render inconsistently across OS/browser/
// font, and a CDN is an avoidable runtime dependency for a small, fixed
// asset set.
export default function CountryCodeSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (iso2: string) => void;
  id?: string;
}) {
  const selected = COUNTRY_CODES.find((c) => c.iso2 === value);
  return (
    <div className="country-code-select">
      <img
        src={`/flags/${value.toLowerCase()}.svg`}
        alt=""
        aria-hidden="true"
        className="country-code-select-flag"
      />
      <span className="country-code-select-code" aria-hidden="true">
        {selected?.dialCode ?? ""}
      </span>
      <ChevronDown size={14} aria-hidden="true" className="country-code-select-chevron" />
      <select
        id={id}
        className="country-code-select-native"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Indicativo do país"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.iso2} value={c.iso2}>
            {c.name} ({c.dialCode})
          </option>
        ))}
      </select>
    </div>
  );
}
