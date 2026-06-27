import os
import ast
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))

url = os.getenv("VITE_SUPABASE_URL")
key = os.getenv("VITE_SUPABASE_ANON_KEY")
organizer_name = 'Anabela'
project_id = 1
print(url,key)

supabase: Client = create_client(url, key)

file_path = os.path.join(os.getcwd(), "events.txt")

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

KNOWN_CREATOR_EMAILS = ['casteloa.luanda@gmail.com']

# ─────────────────────────────────────────────────────────────────────────────
# WAX COST PER SERVICE
# Methodology:
#   • Hard wax bulk price (Portugal/EU): ~€0.035/g
#   • Disposables per service (gloves, spatulas, strips, paper): ~€0.20–0.50
#   • Pre/post products (cleanser, oil, soothing lotion): ~€0.10–0.30
#   • Gram references from industry benchmarks (Starpil/Honeycomb Wax Co.)
#     – Facial/small area: 8–12g
#     – Underarm: 15–25g
#     – Bikini/virilha: 40–60g
#     – Half leg: 100–130g
#     – Full leg (women): 200–250g
#     – Full leg (men, coarser hair): 280–320g
#     – Arms: 80–120g
#     – Chest/back (men): 150–200g
# ─────────────────────────────────────────────────────────────────────────────

WAX_COST_PER_SERVICE_WOMEN = {
    # name                           wax_g  wax_cost  disposables  extras   total_€
    "Perna Inteira":        {"wax_g": 220,  "wax_cost": 7.70, "disposables": 0.50, "extras": 0.30, "total": 8.50},
    "Meia Perna":           {"wax_g": 110,  "wax_cost": 3.85, "disposables": 0.40, "extras": 0.20, "total": 4.45},
    "Sobrancelha":          {"wax_g":   9,  "wax_cost": 0.32, "disposables": 0.25, "extras": 0.10, "total": 0.67},
    "Buço":                 {"wax_g":   6,  "wax_cost": 0.21, "disposables": 0.20, "extras": 0.10, "total": 0.51},
    "Axila":                {"wax_g":  20,  "wax_cost": 0.70, "disposables": 0.25, "extras": 0.15, "total": 1.10},
    "Virilha":              {"wax_g":  35,  "wax_cost": 1.23, "disposables": 0.30, "extras": 0.20, "total": 1.73},
    "Virilha Completa":     {"wax_g":  55,  "wax_cost": 1.93, "disposables": 0.35, "extras": 0.25, "total": 2.53},
    "Braço":                {"wax_g":  90,  "wax_cost": 3.15, "disposables": 0.40, "extras": 0.20, "total": 3.75},
    "Rosto Completo":       {"wax_g":  30,  "wax_cost": 1.05, "disposables": 0.30, "extras": 0.20, "total": 1.55},
    "Costa":                {"wax_g":  60,  "wax_cost": 2.10, "disposables": 0.40, "extras": 0.25, "total": 2.75},
    "Barriga":              {"wax_g":  40,  "wax_cost": 1.40, "disposables": 0.35, "extras": 0.20, "total": 1.95},
    "Nádegas":              {"wax_g":  50,  "wax_cost": 1.75, "disposables": 0.35, "extras": 0.20, "total": 2.30},
    "Pés":                  {"wax_g":  25,  "wax_cost": 0.88, "disposables": 0.30, "extras": 0.15, "total": 1.33},
    "Mãos":                 {"wax_g":  20,  "wax_cost": 0.70, "disposables": 0.25, "extras": 0.15, "total": 1.10},
    "Pintura Unhas":        {"wax_g":   0,  "wax_cost": 0.00, "disposables": 0.20, "extras": 0.30, "total": 0.50},  # nail polish ~€0.30
    "Cortar Unhas Mãos":    {"wax_g":   0,  "wax_cost": 0.00, "disposables": 0.15, "extras": 0.10, "total": 0.25},
    "Cortar Unhas Pés":     {"wax_g":   0,  "wax_cost": 0.00, "disposables": 0.15, "extras": 0.10, "total": 0.25},
    "Alisamento de Sobrancelhas": {"wax_g": 8, "wax_cost": 0.28, "disposables": 0.25, "extras": 0.15, "total": 0.68},
    "Permanente Sobrancelhas": {"wax_g":  8, "wax_cost": 0.28, "disposables": 0.30, "extras": 0.80, "total": 1.38},  # henna/dye product
    "Pintura Sobrancelhas": {"wax_g":   8,  "wax_cost": 0.28, "disposables": 0.25, "extras": 0.50, "total": 1.03},
    # Packages
    "Banho":                {"wax_g": 520,  "wax_cost": 18.20, "disposables": 1.00, "extras": 0.80, "total": 20.00},
    "Tudo":                 {"wax_g": 600,  "wax_cost": 21.00, "disposables": 1.20, "extras": 1.00, "total": 23.20},
    "Massagem":             {"wax_g":   0,  "wax_cost": 0.00,  "disposables": 0.30, "extras": 2.00, "total": 2.30},  # massage oil
}

WAX_COST_PER_SERVICE_MEN = {
    # Men have coarser/denser hair → ~30% more wax than equivalent women's service
    "Perna Inteira":                    {"wax_g": 300, "wax_cost": 10.50, "disposables": 0.60, "extras": 0.40, "total": 11.50},
    "Perna Inteira + Braços":           {"wax_g": 420, "wax_cost": 14.70, "disposables": 0.80, "extras": 0.50, "total": 16.00},
    "Perna Inteira + Peito":            {"wax_g": 480, "wax_cost": 16.80, "disposables": 0.90, "extras": 0.50, "total": 18.20},
    "Perna Inteira + Costas":           {"wax_g": 490, "wax_cost": 17.15, "disposables": 0.90, "extras": 0.50, "total": 18.55},
    "Peito + Axilas":                   {"wax_g": 210, "wax_cost": 7.35,  "disposables": 0.50, "extras": 0.30, "total": 8.15},
    "Peito + Axilas + Costas":          {"wax_g": 380, "wax_cost": 13.30, "disposables": 0.70, "extras": 0.40, "total": 14.40},
    "Peito + Axilas + Costas + Braços": {"wax_g": 500, "wax_cost": 17.50, "disposables": 0.90, "extras": 0.50, "total": 18.90},
    "Nádegas":                          {"wax_g":  70, "wax_cost": 2.45,  "disposables": 0.35, "extras": 0.25, "total": 3.05},
    "Axilas":                           {"wax_g":  30, "wax_cost": 1.05,  "disposables": 0.25, "extras": 0.15, "total": 1.45},
    "Costas":                           {"wax_g": 190, "wax_cost": 6.65,  "disposables": 0.50, "extras": 0.30, "total": 7.45},
    "Peito":                            {"wax_g": 180, "wax_cost": 6.30,  "disposables": 0.50, "extras": 0.30, "total": 7.10},
    "Braços":                           {"wax_g": 120, "wax_cost": 4.20,  "disposables": 0.45, "extras": 0.25, "total": 4.90},
    "Sobrancelhas":                     {"wax_g":  10, "wax_cost": 0.35,  "disposables": 0.25, "extras": 0.10, "total": 0.70},
    "Pés":                              {"wax_g":  30, "wax_cost": 1.05,  "disposables": 0.30, "extras": 0.15, "total": 1.50},
    "Mãos":                             {"wax_g":  25, "wax_cost": 0.88,  "disposables": 0.25, "extras": 0.15, "total": 1.28},
}

# Service keyword mapping (abbreviation → full name from price list)
SERVICE_ALIASES = {
    # Women services
    "P.I":      "Perna Inteira",
    "PI":       "Perna Inteira",
    "M.P":      "Meia Perna",
    "MP":       "Meia Perna",
    "SOB":      "Sobrancelha",
    "SOB.":     "Sobrancelha",
    "S":        "Sobrancelha",
    "AX":       "Axila",
    "V":        "Virilha",
    "TUTAL":    "Virilha Completa",  
    "TOTAL":    "Virilha Completa",
    "ROSTO":    "Rosto Completo",
    "R":        "Rosto Completo",
    "MÃOS":     "Mãos",
    "MAOS":     "Mãos",
    "PÉS":      "Pés",
    "PES":      "Pés",
    "COT":      "Sobrancelha",        
    "BANHO":    "Banho",              # rosto completo + axilas + braços + barriga + costas + virilha completa + pernas inteira + braços 
    "MASSAGEM": "Massagem",           
    "TUDO":     "Tudo",               # full package - rosto completo + axilas + braços + barriga + pernas inteira + virilha completa + costas + nadegas

    # Men services
    "PEITO":    "Peito",
    "COSTAS":   "Costas",
    "BRAÇOS":   "Braço",
    "BRACOS":   "Braço",
    "AXILAS":   "Axila",
    "SOBRANCELHAS": "Sobrancelha",
}

services_women = {
    1:  {"name": "Perna Inteira",                "price": 20.0,  "duration_min": 60},
    2:  {"name": "Meia Perna",                   "price": 12.0,  "duration_min": 20},
    3:  {"name": "Alisamento de Sobrancelhas",   "price": 10.0,  "duration_min": 10},
    4:  {"name": "Permanente Sobrancelhas",      "price": 15.0,  "duration_min": 30},
    5:  {"name": "Pintura Sobrancelhas",         "price": 10.0,  "duration_min": 10},
    6:  {"name": "Buço",                         "price": 3.0,   "duration_min": 7},   # avg 5-10
    7:  {"name": "Sobrancelha",                  "price": 3.5,   "duration_min": 10},
    8:  {"name": "Axila",                        "price": 3.0,   "duration_min": 20},
    9:  {"name": "Virilha",                      "price": 3.0,   "duration_min": 20},
    10: {"name": "Virilha Completa",             "price": 8.0,   "duration_min": 32},  # avg 30-35
    11: {"name": "Braço",                        "price": 8.0,   "duration_min": 20},
    12: {"name": "Rosto Completo",               "price": 6.5,   "duration_min": 15},
    13: {"name": "Costa",                        "price": 4.0,   "duration_min": 30},
    14: {"name": "Barriga",                      "price": 4.0,   "duration_min": 15},
    15: {"name": "Nádegas",                      "price": 4.0,   "duration_min": 27},  # avg 25-30
    16: {"name": "Pés",                          "price": 14.0,  "duration_min": 12},
    17: {"name": "Mãos",                         "price": 5.0,   "duration_min": 30},
    18: {"name": "Pintura Unhas",                "price": 1.5,   "duration_min": 7},   # avg 5-10
    19: {"name": "Cortar Unhas Mãos",            "price": 2.0,   "duration_min": 7},   # avg 5-10
    20: {"name": "Cortar Unhas Pés",             "price": 6.0,   "duration_min": 10},  # avg 10-15
    21: {"name": "Banho",                        "price": 53.5,  "duration_min": 60},
    22: {"name": "Tudo",                         "price": 57.5,  "duration_min": 90}
}

services_men = {
    1:  {"name": "Perna Inteira",                      "price": 24.0,  "duration_min": 90},
    2:  {"name": "Perna Inteira + Braços",             "price": 27.0,  "duration_min": 120},
    3:  {"name": "Perna Inteira + Peito",              "price": 30.0,  "duration_min": 120},
    4:  {"name": "Perna Inteira + Costas",             "price": 33.0,  "duration_min": 120},
    5:  {"name": "Peito + Axilas",                     "price": 16.0,  "duration_min": 40},
    6:  {"name": "Peito + Axilas + Costas",            "price": 19.0,  "duration_min": 60},
    7:  {"name": "Peito + Axilas + Costas + Braços",   "price": 22.0,  "duration_min": 60},
    8:  {"name": "Nádegas",                            "price": 12.0,  "duration_min": 30},
    9:  {"name": "Axilas",                             "price": 5.0,   "duration_min": 10},
    10: {"name": "Costas",                             "price": 13.0,  "duration_min": 30},
    11: {"name": "Peito",                              "price": 13.0,  "duration_min": 30},
    12: {"name": "Braços",                             "price": 13.0,  "duration_min": 25},
    13: {"name": "Sobrancelhas",                       "price": 3.0,   "duration_min": 10},
    14: {"name": "Pés",                                "price": 14.0,  "duration_min": 60},
    15: {"name": "Mãos",                               "price": 5.0,   "duration_min": 30},
}

# Flat lookup by service name → price + duration (merged from both)
all_services = {}

for s in services_women.values():
    key = s["name"].upper()
    all_services[key] = {"price": s["price"], "duration_min": s["duration_min"], "gender": "MULHER"}

for s in services_men.values():
    key = s["name"].upper()
    all_services[key] = {"price": s["price"], "duration_min": s["duration_min"], "gender": "HOMEM"}

def output_events(event, parsed,  attendees):

        event_id            = event.get("id", "")
        service             = " | ".join([i['name'] for i in parsed['services']]) if parsed['services'] else "Desconhecido"
        service_price       = parsed['total_price']
        description         = event.get("description", "")
        location            = event.get("location", "") if event.get("location", "") else "Paivas"
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

        creator_email = event.get('creator', {}).get('email', '')
        if creator_email not in KNOWN_CREATOR_EMAILS:
            continue

        attendees = event.get("attendees", [])
        summary = event.get("summary", "")
        parsed = parse_services(summary)

        if "DENISE" in parsed['client_name'].upper() or "MÃE" in parsed['client_name'].upper() or 'NUNO' in parsed['client_name'].upper():
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
 


