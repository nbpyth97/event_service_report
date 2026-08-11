const { supabaseAdmin } = require('./supabaseAdmin');
const { patchEvent, deleteEvent } = require('./googleCalendar');
const { loadTenantByProjectId } = require('./tenant');

async function getBookingById(id) {
  const { data, error } = await supabaseAdmin
    .from('booking_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Single atomic conditional update: only succeeds while status is still
// 'pending', so a duplicate tap (e.g. a WhatsApp link-preview prefetch, or
// the owner tapping twice) can never double-process the same booking.
async function resolveBooking(id, action) {
  const { data, error } = await supabaseAdmin
    .from('booking_requests')
    .update({ status: action, responded_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select();
  if (error) throw error;
  if (!data || !data.length) return { alreadyHandled: true };

  const booking = data[0];
  const { config } = loadTenantByProjectId(booking.project_id);

  if (action === 'confirmed') {
    await patchEvent({
      calendarId: config.google_write_calendar_id,
      eventId: booking.event_id,
      patch: {
        summary: `${booking.service} - ${booking.customer_name}`,
        colorId: '2',
      },
    });

    await supabaseAdmin.from('events').upsert({
      event_id: booking.event_id,
      project_id: booking.project_id,
      service: booking.service,
      service_price: booking.service_price,
      status: 'confirmed',
      event_start_time: booking.event_start_time,
      event_end_time: booking.event_end_time,
      location: config.default_location,
    });

    await supabaseAdmin.from('clients').upsert({
      event_id: booking.event_id,
      project_id: booking.project_id,
      client_name: booking.customer_name,
      client_phone: booking.customer_phone,
    });
  } else {
    await deleteEvent({ calendarId: config.google_write_calendar_id, eventId: booking.event_id });
  }

  return { booking };
}

module.exports = { resolveBooking, getBookingById };
