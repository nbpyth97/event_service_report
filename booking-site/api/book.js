const crypto = require('crypto');
const { loadTenant } = require('./_lib/tenant');
const { computeSlots } = require('./_lib/availability');
const { findService } = require('./_lib/services');
const { insertEvent, deleteEvent } = require('./_lib/googleCalendar');
const { supabaseAdmin } = require('./_lib/supabaseAdmin');
const { signBookingId } = require('./_lib/token');

function normalizePhone(value) {
  if (!value) return '';
  let digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  // Customers aren't expected to type the country code - a bare 9-digit
  // Portuguese mobile number gets 351 prepended automatically.
  if (digits.length === 9 && !digits.startsWith('351')) {
    digits = '351' + digits;
  }
  return digits;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  try {
    const { tenant: tenantSlug, gender, service: serviceSlug, date, start, name, phone } = req.body || {};
    if (!tenantSlug || !gender || !serviceSlug || !date || !start || !name || !phone) {
      res.status(400).json({ error: 'Preencha todos os campos.' });
      return;
    }

    const { config, services } = loadTenant(tenantSlug);
    const service = findService(services, gender, serviceSlug);
    if (!service) {
      res.status(404).json({ error: 'Serviço não encontrado.' });
      return;
    }

    const slotStart = new Date(start);
    if (Number.isNaN(slotStart.getTime())) {
      res.status(400).json({ error: 'Horário inválido.' });
      return;
    }

    // Re-validate against live availability right before writing anything -
    // never trust what the frontend cached a moment earlier.
    const freshSlots = await computeSlots({ tenantConfig: config, dateStr: date, durationMin: service.duration_min });
    if (!freshSlots.includes(slotStart.toISOString())) {
      res.status(409).json({ error: 'Este horário já não está disponível. Escolha outro, por favor.' });
      return;
    }

    const slotEnd = new Date(slotStart.getTime() + service.duration_min * 60000);
    const phoneDigits = normalizePhone(phone);
    const bookingId = crypto.randomUUID();
    const confirmToken = signBookingId(bookingId);

    let calendarEvent;
    try {
      calendarEvent = await insertEvent({
        calendarId: config.google_write_calendar_id,
        event: {
          summary: `PENDENTE - ${service.name} - ${name}`,
          description: `Pedido de marcação online. Telefone: ${phone}`,
          start: { dateTime: slotStart.toISOString(), timeZone: config.timezone },
          end: { dateTime: slotEnd.toISOString(), timeZone: config.timezone },
          colorId: '8',
          extendedProperties: { private: { source: 'booking-site', booking_request_id: bookingId } },
        },
      });
    } catch (err) {
      console.error('Falha ao criar evento tentativo no calendário:', err);
      res.status(500).json({ error: 'Não foi possível completar o pedido. Tente novamente.' });
      return;
    }

    try {
      const { error } = await supabaseAdmin.from('booking_requests').insert({
        id: bookingId,
        project_id: config.project_id,
        event_id: calendarEvent.id,
        service: service.name,
        service_price: service.price,
        event_start_time: slotStart.toISOString(),
        event_end_time: slotEnd.toISOString(),
        customer_name: name,
        customer_phone: phoneDigits,
        confirm_token: confirmToken,
      });
      if (error) throw error;
    } catch (err) {
      console.error('Falha ao gravar pedido - a remover evento tentativo órfão:', err);
      try {
        await deleteEvent({ calendarId: config.google_write_calendar_id, eventId: calendarEvent.id });
      } catch (cleanupErr) {
        console.error('Falha ao limpar evento tentativo órfão:', cleanupErr);
      }
      res.status(500).json({ error: 'Não foi possível completar o pedido. Tente novamente.' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro inesperado. Tente novamente.' });
  }
};
