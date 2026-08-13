// wa.me wants digits only (country code + number, no "+", spaces, or dashes) —
// stripping non-digits is the documented way to normalize whatever format the
// number was entered in.
export function waLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
