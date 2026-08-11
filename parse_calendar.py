import argparse
import os
import ast
import json
from supabase import create_client, Client
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))

url = os.getenv("VITE_SUPABASE_URL")
key = os.getenv("VITE_SUPABASE_ANON_KEY")
print(url, key)

supabase: Client = create_client(url, key)

parser = argparse.ArgumentParser()
parser.add_argument('--tenant', required=True, help="Tenant folder name under tenants/, e.g. 'anabela'")
args = parser.parse_args()

TENANT_DIR = os.path.join(BASE_DIR, 'tenants', args.tenant)

with open(os.path.join(TENANT_DIR, 'config.json'), 'r', encoding='utf-8') as f:
    tenant_config = json.load(f)

with open(os.path.join(TENANT_DIR, 'services.json'), 'r', encoding='utf-8') as f:
    tenant_services = json.load(f)

project_id = tenant_config['project_id']
KNOWN_CREATOR_EMAILS = tenant_config['known_creator_emails']
EXCLUDED_CLIENT_NAMES = tenant_config['excluded_client_names']
DEFAULT_LOCATION = tenant_config['default_location']

file_path = os.path.join(BASE_DIR, tenant_config['events_file'])

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Service keyword mapping (abbreviation → full name from price list)
SERVICE_ALIASES = tenant_services['aliases']

# Flat lookup by service name → price + duration (merged from both genders)
all_services = {}

for name, s in tenant_services['women'].items():
    all_services[name.upper()] = {"price": s["price"], "duration_min": s["duration_min"], "gender": "MULHER"}

for name, s in tenant_services['men'].items():
    all_services[name.upper()] = {"price": s["price"], "duration_min": s["duration_min"], "gender": "HOMEM"}

def output_events(event, parsed,  attendees):

        event_id            = event.get("id", "")
        service             = " | ".join([i['name'] for i in parsed['services']]) if parsed['services'] else "Desconhecido"
        service_price       = parsed['total_price']
        description         = event.get("description", "")
        location            = event.get("location", "") if event.get("location", "") else DEFAULT_LOCATION
        status              = event.get("status", "")
        organizer_email     = attendees[0].get("email", "") if attendees else "" 
        organizer_name      = str(event.get("description", {})).split('Who:')[-1].strip().split('- Organizer')[0].strip()
        client_name         = parsed['client_name']
        client_nr           = str(event.get("attendees", [])[1].get("email","")).split('@')[0] if len(attendees) > 1 else ""
        created_event_date  = event.get("created", "")
        updated_event_date  = event.get("updated", "")
        event_start_time    = event.get("start").get("dateTime") if event.get("start") else ""
        event_end_time      = event.get("end").get("dateTime") if event.get("end") else ""

        return {
            "event_id": event_id,
            "service": service,
            "service_price": service_price,
            "description": description,
            "location": location,
            "status": status,
            "organizer_email": organizer_email,
            "organizer_name": organizer_name,
            "client_name": client_name,
            "client_nr": client_nr,
            "created_event_date": created_event_date,
            "updated_event_date": updated_event_date,
            "event_start_time": event_start_time,
            "event_end_time": event_end_time
        }

def parse_services(summary):
    """
    Given a calendar summary, handles two formats:
    1. Cal.com: 'Mulher - Perna Inteira between Anabela Castelôa and Anabela'
    2. Manual:  'ANABELA MENDES ROSTO,AX,V'
    """
    summary_upper = summary.upper().strip()

    # ── Cal.com format: "Mulher - Perna Inteira between NAME and NAME" ──
    if ' ENTRE ' in summary_upper:
        # Extract service part (before "between")
        service_part = summary_upper.split(' BETWEEN ')[0].strip()

        # Remove "Mulher - " or "Homem - " prefix if present
        if ' - ' in service_part:
            service_part = service_part.split(' - ', 1)[-1].strip()

        # Extract client name (first person after "between")
        between_part = summary.lower().split(' between ')[-1]
        client_name = between_part.split(' and ')[0].strip().title()

        # Look up the service by full name
        service_data = all_services.get(service_part, {})
        found_services = [{
            "alias": service_part,
            "name": service_part.title(),
            "price": service_data.get("price", 0.0),
            "duration_min": service_data.get("duration_min", 0),
        }] if service_data else []

        total_price = sum(s["price"] for s in found_services) if found_services else 15
        total_duration = sum(s["duration_min"] for s in found_services) if found_services else 45

        return {
            "client_name": client_name,
            "services": found_services,
            "total_price": total_price,
            "total_duration_min": total_duration,
        }

    # ── Manual format: "ANABELA MENDES ROSTO,AX,V" ──
    parts = [p.strip() for p in summary_upper.replace(',', ' ').replace(';', ' ').split()]

    found_services = []
    name_parts = []

    sorted_aliases = sorted(SERVICE_ALIASES.keys(), key=len, reverse=True)
    matched_keywords = set()

    for part in parts:
        matched = False
        for alias in sorted_aliases:
            if part == alias:
                service_full_name = SERVICE_ALIASES[alias]
                if service_full_name not in matched_keywords:
                    matched_keywords.add(service_full_name)
                    service_data = all_services.get(service_full_name.upper(), {})
                    found_services.append({
                        "alias": alias,
                        "name": service_full_name,
                        "price": service_data.get("price", 0.0),
                        "duration_min": service_data.get("duration_min", 0),
                    })
                matched = True
                break

        if not matched:
            name_parts.append(part)

    cleaned_name_parts = name_parts[:]
    while cleaned_name_parts and (any(ch.isdigit() for ch in cleaned_name_parts[-1]) or '€' in cleaned_name_parts[-1]):
        cleaned_name_parts.pop()

    client_name = ' '.join(cleaned_name_parts).title() if found_services else ""
    total_price = sum(s["price"] for s in found_services) if found_services else 15
    total_duration = sum(s["duration_min"] for s in found_services) if found_services else 45

    return {
        "client_name": client_name,
        "services": found_services,
        "total_price": total_price,
        "total_duration_min": total_duration,
    }


chunks = content.split('$$$')

for chunk in chunks:
    if not chunk.strip():
        continue

    events = ast.literal_eval(chunk)
    for event in events:
        if not event.get('start', {}).get('dateTime'):
            continue

        if event.get('extendedProperties', {}).get('private', {}).get('source') == 'booking-site':
            # Written directly by the booking site's confirm/decline endpoints -
            # skip so this pipeline never overwrites it with a mis-parsed guess.
            continue

        creator_email = event.get('creator', {}).get('email', '')
        if creator_email not in KNOWN_CREATOR_EMAILS:
            continue

        attendees = event.get("attendees", [])
        summary = event.get("summary", "")
        parsed = parse_services(summary)

        if any(name in parsed['client_name'].upper() for name in EXCLUDED_CLIENT_NAMES):
            continue

        dict_event = output_events(event, parsed, attendees)

        event_id           = dict_event['event_id']
        service            = dict_event['service']
        service_price      = dict_event['service_price']
        description        = dict_event['description']
        location           = dict_event['location']
        status             = dict_event['status']
        organizer_email    = dict_event['organizer_email']
        organizer_name     = dict_event['organizer_name']
        client_name        = dict_event['client_name']
        client_nr          = dict_event['client_nr']
        created_event_date = dict_event['created_event_date']
        updated_event_date = dict_event['updated_event_date']
        event_start_time   = dict_event['event_start_time']
        event_end_time     = dict_event['event_end_time']

        print(f"Processing event ID {event_id}: service={service}, price={service_price}, client={client_name}")


        #INSERT INTO TABLE
        try:
            if service != "":
                supabase.schema("public").table("events").upsert({
                    "event_id": event_id,
                    "project_id": f"{project_id}",
                    "service": service,
                    "service_price": service_price,
                    "description": description,
                    "location": location,
                    "status": status,
                    "event_start_time": event_start_time,
                    "event_end_time": event_end_time,
                    "created_event_date": created_event_date,
                    "updated_event_date": updated_event_date,
                    "organizer_email": organizer_email
                    }).execute()

                if client_name:
                    supabase.schema("public").table("clients").upsert({
                        "event_id": event_id,
                        "project_id": f"{project_id}",
                        "client_name": client_name,
                        "client_phone": client_nr
                    }).execute()

                supabase.schema("public").table("organizers").upsert({
                    "event_id": event_id,
                    "project_id": f"{project_id}",
                    "organizer_email": organizer_email,
                    "organizer_name": organizer_name
                }).execute()
        except Exception as e:
            print(f"{e}")
            continue
 


