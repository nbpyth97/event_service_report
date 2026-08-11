export async function fetchAvailability({ tenant, gender, service, date }) {
  const params = new URLSearchParams({ tenant, gender, service, date });
  const res = await fetch(`/api/availability?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Não foi possível carregar os horários.');
  return data;
}

export async function submitBooking({ tenant, gender, service, date, start, name, phone }) {
  const res = await fetch('/api/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant, gender, service, date, start, name, phone }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Não foi possível enviar o pedido.');
  return data;
}
