const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const TENANT = process.env.TENANT;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials in ../.env (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).');
  process.exit(1);
}

if (!TENANT) {
  console.error('Missing TENANT env var. Run as: TENANT=anabela node index.js');
  process.exit(1);
}

const tenantConfigPath = path.resolve(__dirname, '..', 'tenants', TENANT, 'config.json');
const tenantConfig = JSON.parse(fs.readFileSync(tenantConfigPath, 'utf-8'));
const PROJECT_ID = tenantConfig.project_id;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalizePhone(value) {
  if (!value) return '';
  let digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  return digits;
}

function tomorrowBounds() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatHour(dateLike) {
  if (!dateLike) return '--:--';
  const d = new Date(dateLike);
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function buildReminderMessage(clientName, appointments) {
  const lines = appointments
    .sort((a, b) => new Date(a.event_start_time) - new Date(b.event_start_time))
    .map((a) => `- ${formatHour(a.event_start_time)} · ${a.service || 'Serviço'}`)
    .join('\n');

  return [
    `Olá ${clientName || ''},`.trim(),
    'Lembrete das suas marcações para amanhã:',
    lines,
    'Até amanhã!\n',
  ].join('\n');
}

async function fetchTomorrowRecipients() {
  const { start, end } = tomorrowBounds();

  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('event_id, service, event_start_time, status')
    .eq('project_id', PROJECT_ID)
    .gte('event_start_time', start.toISOString())
    .lte('event_start_time', end.toISOString())
    .neq('status', 'cancelled');

  if (eventsError) throw eventsError;
  if (!events || events.length === 0) return [];

  const eventIds = [...new Set(events.map((e) => e.event_id).filter(Boolean))];
  if (!eventIds.length) return [];

  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('event_id, client_name, client_phone')
    .eq('project_id', PROJECT_ID)
    .in('event_id', eventIds);

  if (clientsError) throw clientsError;

  const clientByEvent = new Map((clients || []).map((c) => [c.event_id, c]));
  const groupedByPhone = new Map();

  for (const ev of events) {
    const cl = clientByEvent.get(ev.event_id);
    const phone = normalizePhone(cl?.client_phone);
    if (!phone) continue;

    if (!groupedByPhone.has(phone)) {
      groupedByPhone.set(phone, {
        phone,
        clientName: cl?.client_name || '',
        appointments: [],
      });
    }

    groupedByPhone.get(phone).appointments.push(ev);
  }

  return Array.from(groupedByPhone.values());
}

const client = new Client({
  authStrategy: new LocalAuth({ clientId: TENANT }),
});

client.on('qr', (qr) => {
  console.log('Scan this QR code with WhatsApp:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  console.log('WhatsApp connected!');

  try {
    const recipients = await fetchTomorrowRecipients();

    if (!recipients.length) {
      console.log('No reminders to send for tomorrow (or no client phone numbers found).');
      process.exit(0);
    }

    for (const rec of recipients) {
      const chatId = `${rec.phone}@c.us`;
      const message = buildReminderMessage(rec.clientName, rec.appointments);
      await client.sendMessage(chatId, message);
      console.log(`Reminder sent to ${rec.phone} (${rec.appointments.length} appointment(s)).`);
    }

    console.log(`Done. Sent ${recipients.length} reminder(s).`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to send reminders:', err);
    process.exit(1);
  }
});

client.on('auth_failure', (msg) => {
  console.error('Authentication failure:', msg);
});

client.on('disconnected', (reason) => {
  console.log('Client disconnected:', reason);
});

client.initialize();
