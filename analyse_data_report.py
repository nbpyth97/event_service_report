import ast
import os
import re
from collections import Counter
from datetime import datetime
from fpdf import FPDF

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EVENTS_PATH = os.path.join(BASE_DIR, 'events.txt')
PDF_PATH = os.path.join(BASE_DIR, 'google_calendar_data_analysis.pdf')

if not os.path.exists(EVENTS_PATH):
    raise FileNotFoundError(f'Could not find {EVENTS_PATH}')

with open(EVENTS_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

chunks = [chunk for chunk in content.split('$$$') if chunk.strip()]
all_events = []
for i, chunk in enumerate(chunks, 1):
    try:
        parsed = ast.literal_eval(chunk)
    except Exception as exc:
        print(f'chunk {i} parse failed:', exc)
        continue
    if isinstance(parsed, list):
        all_events.extend(parsed)
    else:
        print(f'chunk {i} is not a list, type={type(parsed)}')

not_names = {
    'horário', 'entrada', 'flight', 'sexta-feira', 'véspera',
    'restauração', 'advogada', 'implantação', 'natal', 'carnaval',
    'ano', 'frança', 'portugal', 'mãe', '🧳✈️🛬', '🌈', 'óculos', 'fara',
    'dia', 'corpo', 'páscoa'
}

price_pattern = re.compile(r'Preço:\s*([^€\n]+)€')
client_pattern = re.compile(r'What:\s*(.*?)Invitee', re.DOTALL)

appointments = []
holidays_or_others = []
services = Counter()
clients = Counter()
price_values = []
duration_hours = []

for event in all_events:
    summary = (event.get('summary') or '').strip()
    desc = (event.get('description') or '')
    start = (event.get('start') or {}).get('dateTime') or (event.get('start') or {}).get('date')
    end = (event.get('end') or {}).get('dateTime') or (event.get('end') or {}).get('date')

    if not summary:
        holidays_or_others.append(summary)
        continue

    first_word = summary.lower().split()[0]
    if first_word in not_names or any(kw in summary.lower() for kw in ['day', 'holiday', "new year's", 'armistice', 'all saints', 'bastille']):
        holidays_or_others.append(summary)
        continue

    services[summary] += 1
    client_match = client_pattern.search(desc)
    client_name = client_match.group(1).strip() if client_match else '<unknown>'
    clients[client_name] += 1

    price_match = price_pattern.search(desc)
    price = None
    if price_match:
        try:
            price = int(price_match.group(1).strip())
            price_values.append(price)
        except ValueError:
            price = None

    if start and end and 'T' in start and 'T' in end:
        try:
            start_dt = datetime.fromisoformat(start.replace('Z', ''))
            end_dt = datetime.fromisoformat(end.replace('Z', ''))
            duration_hours.append((end_dt - start_dt).total_seconds() / 3600)
        except Exception:
            pass

    appointments.append({
        'summary': summary,
        'client': client_name,
        'start': start,
        'end': end,
        'price': price,
    })

month_counts = Counter()
for appt in appointments:
    start = appt['start']
    if start and 'T' in start:
        month_counts[start[:7]] += 1

pdf = FPDF()
pdf.set_auto_page_break(auto=True, margin=15)
pdf.add_page()
pdf.set_font('Arial', 'B', 16)
pdf.cell(0, 10, 'Google Calendar Data Analysis', ln=True)
pdf.set_font('Arial', '', 12)
pdf.ln(4)

lines = [
    'Source: events.txt parsed using parse_calendar-style logic',
    'This report summarizes your calendar dataset and highlights data quality',
    'and operational improvement opportunities for your business.',
    '',
    f'Total event chunks: {len(chunks)}',
    f'Total raw events: {len(all_events)}',
    f'Appointment-like events: {len(appointments)}',
    f'Filtered holiday/non-booking events: {len(holidays_or_others)}',
    f'Unique service summaries: {len(services)}',
    f'Unique client keys: {len(clients)}',
    f'Parsed price values: {len(price_values)}',
    f'  Price range: {min(price_values) if price_values else 0} - {max(price_values) if price_values else 0}',
    f'  Average parsed price: {sum(price_values)/len(price_values) if price_values else 0:.2f}',
    f'Missing price count: {len(appointments) - len(price_values)}',
    f'Recorded durations: {len(duration_hours)}',
    f'  Duration range: {min(duration_hours) if duration_hours else 0:.2f} - {max(duration_hours) if duration_hours else 0:.2f} hours',
    f'  Average duration: {sum(duration_hours)/len(duration_hours) if duration_hours else 0:.2f} hours',
    '',
    'Monthly appointment counts:',
]
for month, count in month_counts.most_common(12):
    lines.append(f'  {month}: {count}')

lines.extend([
    '',
    'Key findings:',
    '- Your data includes many holiday/public calendar entries and generic',
    '  booking markers that should not be counted as revenue appointments.',
    '- Pricing extraction is incomplete: most appointment-like records do not',
    '  contain a parseable price value.',
    '- Client identification is inconsistent because event text is parsed',
    '  from free-form description rather than structured fields.',
    '- The current parser does not reliably separate actual service bookings',
    '  from meetings, reminders, or non-revenue calendar events.',
    '',
    'Recommendations:',
    '1. Clean the dataset by excluding holidays and non-service calendar entries.',
    '2. Standardize event data with explicit fields for service, price, client,',
    '   and duration.',
    '3. Extract actual revenue data from appointments and link it to booked time.',
    '4. Track utilization by time slot and margin by service.',
    '5. Use follow-up reminders and loyalty offers for repeat clients.',
    '6. Create bundled service packages to increase average ticket value.',
    '',
    'Operational improvements:',
    '- Validate appointment records before storing them in Supabase.',
    '- Add a service category and cost margin for every booked treatment.',
    '- Monitor no-shows, cancellations, and idle booking windows.',
    '- Prioritize high-margin appointments and optimize scheduling gaps.',
])

for line in lines:
    pdf.multi_cell(0, 7, line)

pdf.output(PDF_PATH)
print('PDF written to', PDF_PATH)
