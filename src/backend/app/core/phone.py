import phonenumbers
from phonenumbers import NumberParseException, PhoneNumberFormat

# The pilot tenant's country — only matters as a fallback for a `phone` with
# no leading "+" (see to_e164 below); every "+"-prefixed number ignores it.
DEFAULT_REGION = "PT"


def to_e164(raw: str, country: str) -> str:
    """Parse a customer-typed phone number into the canonical E.164 form
    ("+<country code><national number>", e.g. "+351912345678") using real
    per-country numbering-plan rules — not a digit-count guess. `country` is
    the ISO 3166-1 alpha-2 region to interpret `raw` against (e.g. "PT") when
    it has no leading "+"; a "+"-prefixed `raw` always wins over `country`,
    since that's an explicit, unambiguous country code (this is `phonenumbers`'
    own parsing behaviour, not something this function decides). Storing the
    "+" (unlike the old digit-only convention) is what lets a stored number be
    round-tripped back through this same function without re-supplying the
    original country — see the 20250821_backfill_phone_leading_plus migration
    for the one-time conversion of already-stored digit-only numbers."""
    region = country.strip().upper()
    if region not in phonenumbers.SUPPORTED_REGIONS:
        raise ValueError(f"País '{region}' não reconhecido.")
    try:
        parsed = phonenumbers.parse(raw, region)
    except NumberParseException as exc:
        raise ValueError("Número de telefone inválido.") from exc
    if not phonenumbers.is_valid_number(parsed):
        raise ValueError("Número de telefone inválido para o país indicado.")
    return phonenumbers.format_number(parsed, PhoneNumberFormat.E164)
