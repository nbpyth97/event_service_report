const { getAccessToken } = require('./googleAuth');

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

async function googleFetch(path, options = {}) {
  const accessToken = await getAccessToken();
  const res = await fetch(`${CALENDAR_API}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro da API do Google Calendar (${res.status}): ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function freeBusy({ calendarIds, timeMin, timeMax, timeZone }) {
  const ids = Array.isArray(calendarIds) ? calendarIds : [calendarIds];
  const data = await googleFetch('/freeBusy', {
    method: 'POST',
    body: JSON.stringify({ timeMin, timeMax, timeZone, items: ids.map((id) => ({ id })) }),
  });
  const busy = [];
  for (const id of ids) {
    const cal = data.calendars && data.calendars[id];
    if (cal && cal.busy) busy.push(...cal.busy);
  }
  return busy;
}

async function insertEvent({ calendarId, event }) {
  return googleFetch(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

async function patchEvent({ calendarId, eventId, patch }) {
  return googleFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

async function deleteEvent({ calendarId, eventId }) {
  return googleFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  });
}

module.exports = { freeBusy, insertEvent, patchEvent, deleteEvent };
