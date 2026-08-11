const { freeBusy } = require('./googleCalendar');
const { zonedTimeToUtc } = require('./timezone');

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function getDayOfWeekKey(dateStr) {
  // dateStr is the calendar date the customer picked, already expressed in
  // the tenant's own local calendar (not UTC) - derive weekday straight
  // from the numbers, at noon to stay clear of any date-line edge cases.
  const [y, m, d] = dateStr.split('-').map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  return DOW_KEYS[noon.getUTCDay()];
}

async function computeSlots({ tenantConfig, dateStr, durationMin, now }) {
  const { timezone, business_hours, google_freebusy_calendar_ids, slot_interval_min, min_lead_time_min } = tenantConfig;

  const dow = getDayOfWeekKey(dateStr);
  const hours = business_hours[dow];
  if (!hours) return [];

  const openUtc = zonedTimeToUtc(dateStr, hours.open, timezone);
  const closeUtc = zonedTimeToUtc(dateStr, hours.close, timezone);

  const busy = await freeBusy({
    calendarIds: google_freebusy_calendar_ids,
    timeMin: openUtc.toISOString(),
    timeMax: closeUtc.toISOString(),
    timeZone: timezone,
  });
  const busyIntervals = busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));

  const earliestAllowed = addMinutes(now || new Date(), min_lead_time_min || 0);

  const slots = [];
  let cursor = openUtc;
  while (addMinutes(cursor, durationMin).getTime() <= closeUtc.getTime()) {
    const slotStart = cursor;
    const slotEnd = addMinutes(cursor, durationMin);
    const overlapsBusy = busyIntervals.some((b) => slotStart < b.end && slotEnd > b.start);
    const inFuture = slotStart.getTime() >= earliestAllowed.getTime();
    if (!overlapsBusy && inFuture) {
      slots.push(slotStart.toISOString());
    }
    cursor = addMinutes(cursor, slot_interval_min);
  }
  return slots;
}

module.exports = { computeSlots };
