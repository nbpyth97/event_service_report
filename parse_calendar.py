import os
import ast
import pandas as pd
from supabase import create_client, Client

url = "https://yaqybiaemnejqquuvpsw.supabase.co"
key = "sb_publishable_Q3PLqXfv9_iGNLvNHmTpYw_XvrT75Z3"
project_id = 1

supabase: Client = create_client(url, key)

file_path = os.path.join(os.getcwd(), "events.txt")

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()


chunks = content.split('$$$')

event_list = []

for chunk in chunks:
    if not chunk.strip():
        continue

    events = ast.literal_eval(chunk)

    for event in events:
        
        if "Mulher -" in event.get("summary", "") or "Homem -" in event.get("summary", ""):
            print(event)
            attendees = event.get("attendees", [])

            event_id = event.get("id", "")
            service =  event.get("summary", "") if any(x in event.get("summary", "") for x in ('Mulher', 'Homem')) else ""
            service_price = int(str(event.get("description", "")).split('€')[0].strip().split('Preço:')[-1].strip())
            description = event.get("description", "")
            location = event.get("location", "")
            status = event.get("status", "")
            organizer_email = attendees[0].get("email", "") if attendees else "" 
            organizer_name = str(event.get("description", {})).split('Who:')[-1].strip().split('- Organizer')[0].strip()
            client_name = str(event.get("description", {})).split('What:')[-1].strip().split('Invitee')[0].strip().split('and')[-1]
            client_nr = str(event.get("attendees", [])[1].get("email","")).split('@')[0] if len(attendees) > 1 else ""
            created_event_date = event.get("created", "")
            updated_event_date = event.get("updated", "")
            event_start_time = event.get("start").get("dateTime") if event.get("start") else ""
            event_end_time = event.get("end").get("dateTime") if event.get("end") else ""

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
 


