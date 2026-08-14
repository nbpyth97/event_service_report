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
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}
