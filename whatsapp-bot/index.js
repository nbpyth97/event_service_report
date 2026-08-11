const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
// Uses the service-role key, not the public anon key: this script runs locally
// (trusted context, not a browser) and needs to read/write booking_requests,
// which has no anon-accessible RLS policy since it holds customer PII.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT = process.env.TENANT;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials in ../.env (VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).');
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

const DAYS_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function formatDateTime(dateLike) {
  if (!dateLike) return '--';
  const d = new Date(dateLike);
  return `${DAYS_PT[d.getDay()]}, ${d.getDate()} de ${MONTHS_PT[d.getMonth()]} às ${formatHour(d)}`;
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
    .neq('status', 'cancelled')
    .eq('reminder_sent', false);

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

// ─── Booking-request notifications ─────────────────────────────────────────

async function fetchPendingOwnerNotifications() {
  const { data, error } = await supabase
    .from('booking_requests')
    .select('*')
    .eq('project_id', PROJECT_ID)
    .eq('status', 'pending')
    .eq('notified_owner', false);

  if (error) throw error;
  return data || [];
}

async function fetchPendingCustomerNotifications() {
  const { data, error } = await supabase
    .from('booking_requests')
    .select('*')
    .eq('project_id', PROJECT_ID)
    .neq('status', 'pending')
    .eq('notified_customer', false);

  if (error) throw error;
  return data || [];
}

function buildOwnerRequestMessage(row) {
  const baseUrl = tenantConfig.booking_site_url;
  const actionUrl = `${baseUrl}/api/action?id=${row.id}&token=${row.confirm_token}`;

  return [
    'Novo pedido de marcação:',
    `Cliente: ${row.customer_name}`,
    `Serviço: ${row.service}`,
    `Telefone: ${row.customer_phone}`,
    `Quando: ${formatDateTime(row.event_start_time)}`,
    '',
    `Ver pedido: ${actionUrl}`,
  ].join('\n');
}

function buildCustomerOutcomeMessage(row) {
  const greeting = `Olá ${row.customer_name || ''},`.trim();
  if (row.status === 'confirmed') {
    return [
      greeting,
      `A sua marcação para "${row.service}" foi confirmada:`,
      formatDateTime(row.event_start_time),
      'Até já!',
    ].join('\n');
  }
  return [
    greeting,
    `Infelizmente não foi possível confirmar a sua marcação para "${row.service}" (${formatDateTime(row.event_start_time)}).`,
    'Pode tentar marcar noutro horário no nosso site de marcações.',
  ].join('\n');
}

// Resolves a phone number to WhatsApp's actual chat id via a server lookup
// rather than guessing `${phone}@c.us` directly - recent WhatsApp accounts
// use an internal LID (linked id) mapping, and sending to a hand-built id
// can fail with "No LID for user" even for valid, reachable numbers.
async function resolveChatId(waClient, phone) {
  const numberId = await waClient.getNumberId(phone);
  if (!numberId) return null;
  return numberId._serialized;
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

  // Job 1: tomorrow's appointment reminders (existing behaviour).
  try {
    const recipients = await fetchTomorrowRecipients();
    for (const rec of recipients) {
      const chatId = await resolveChatId(client, rec.phone);
      if (!chatId) {
        console.log(`Número não registado no WhatsApp, a saltar: ${rec.phone}`);
        continue;
      }
      const message = buildReminderMessage(rec.clientName, rec.appointments);
      await client.sendMessage(chatId, message);
      await wait(2000);
      console.log(`Reminder sent to ${rec.phone} (${rec.appointments.length} appointment(s)).`);

      const eventIds = rec.appointments.map((a) => a.event_id).filter(Boolean);
      const { error: markError } = await supabase
        .from('events')
        .update({ reminder_sent: true })
        .eq('project_id', PROJECT_ID)
        .in('event_id', eventIds);
      if (markError) throw markError;
    }
    console.log(`Lembretes enviados: ${recipients.length}.`);
  } catch (err) {
    console.error('Falha ao enviar lembretes:', err);
  }

  // Job 2: notify the business owner about new pending booking requests.
  try {
    const ownerPhone = normalizePhone(tenantConfig.owner_whatsapp_number);
    if (!ownerPhone) {
      console.log('Sem owner_whatsapp_number configurado - a saltar notificações ao proprietário.');
    } else {
      const ownerChatId = await resolveChatId(client, ownerPhone);
      if (!ownerChatId) {
        console.log(`Número do proprietário não registado no WhatsApp: ${ownerPhone}`);
      } else {
        const pending = await fetchPendingOwnerNotifications();
        for (const row of pending) {
          await client.sendMessage(ownerChatId, buildOwnerRequestMessage(row));
          // Small pacing delay - back-to-back sendMessage calls right after a
          // reconnect have been observed to resolve successfully locally while
          // WhatsApp silently drops the message, so we don't fire messages in
          // a tight loop.
          await wait(2000);
          const { error } = await supabase
            .from('booking_requests')
            .update({ notified_owner: true })
            .eq('id', row.id);
          if (error) throw error;
          console.log(`Proprietário notificado do pedido ${row.id}.`);
        }
        console.log(`Pedidos notificados ao proprietário: ${pending.length}.`);
      }
    }
  } catch (err) {
    console.error('Falha ao notificar o proprietário sobre pedidos pendentes:', err);
  }

  // Job 3: notify customers of the outcome (confirmed/declined) of their request.
  try {
    const resolved = await fetchPendingCustomerNotifications();
    let notifiedCount = 0;
    for (const row of resolved) {
      const phone = normalizePhone(row.customer_phone);
      if (!phone) continue;
      const chatId = await resolveChatId(client, phone);
      if (!chatId) {
        console.log(`Número do cliente não registado no WhatsApp, a saltar: ${phone}`);
        continue;
      }
      await client.sendMessage(chatId, buildCustomerOutcomeMessage(row));
      await wait(2000);
      const { error } = await supabase
        .from('booking_requests')
        .update({ notified_customer: true })
        .eq('id', row.id);
      if (error) throw error;
      notifiedCount++;
      console.log(`Cliente notificado do resultado do pedido ${row.id}.`);
    }
    console.log(`Clientes notificados: ${notifiedCount}.`);
  } catch (err) {
    console.error('Falha ao notificar clientes sobre o resultado dos pedidos:', err);
  }

  // Close the underlying Puppeteer/Chrome browser before exiting - without
  // this, every scheduled run leaks an orphaned Chrome process instead of
  // shutting it down cleanly.
  try {
    await client.destroy();
  } catch (err) {
    console.error('Falha ao encerrar sessão do WhatsApp:', err);
  }
  process.exit(0);
});

client.on('auth_failure', (msg) => {
  console.error('Authentication failure:', msg);
});

client.on('disconnected', (reason) => {
  console.log('Client disconnected:', reason);
});

client.initialize();
