from __future__ import print_function
import argparse
import datetime
import json
import os.path
import requests
import os
# import spacy

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_tenant_config(tenant):
    config_path = os.path.join(BASE_DIR, 'tenants', tenant, 'config.json')
    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def main(tenant):
    config = load_tenant_config(tenant)
    token_path = os.path.join(BASE_DIR, config['google_token_path'])
    credentials_path = os.path.join(BASE_DIR, config['google_credentials_path'])
    events_path = os.path.join(BASE_DIR, config['events_file'])

    creds = None

    # Load saved token
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    # If no valid credentials, log in
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                credentials_path, SCOPES)
            creds = flow.run_local_server(port=0)

        # Save credentials
        with open(token_path, 'w') as token:
            token.write(creds.to_json())

    # show which account is logged in
    user_info = requests.get(
        'https://www.googleapis.com/oauth2/v1/userinfo',
        params={'access_token': creds.token}
    ).json()
    print("Logged in as:", user_info.get('email'))

    service = build('calendar', 'v3', credentials=creds)

    # DEBUG: list all calendars
    print("\nYour calendars:")
    calendar_list = service.calendarList().list().execute()
    
    # Time range: ALL past events
    now = datetime.datetime.utcnow().isoformat() + 'Z'

    # Fetch all pages
    time_min = (datetime.datetime.utcnow() - datetime.timedelta(days=7*1)).isoformat() + 'Z'
    time_max = (datetime.datetime.utcnow() + datetime.timedelta(days=30*1)).isoformat() + 'Z'
    # time_min = (datetime.datetime.utcnow() - datetime.timedelta(days=0)).isoformat() + 'Z'
    # time_max = (datetime.datetime.utcnow() + datetime.timedelta(days=1)).isoformat() + 'Z'

    list_of_events = [] # that goes to the function 
    events = []
    seen_events = set()

    for cal in calendar_list['items']:
        page_token = None

        while True:
            events_result = service.events().list(
                    calendarId=f"{cal['id']}",
                    timeMin=time_min,
                    timeMax=time_max,
                    maxResults=250,
                    singleEvents=True,
                    orderBy='startTime',
                    pageToken=page_token
                ).execute()

            for event in events_result.get('items', []):
                event_key = (cal['id'], event.get('id'))
                if event_key in seen_events:
                    continue
                seen_events.add(event_key)
                events.append(event)

            page_token = events_result.get('nextPageToken')
            if not page_token:
                break

    events = sorted(
        events,
        key=lambda e: e['start'].get('dateTime') or e['start'].get('date'),
        reverse=True
    )

    print('write event')

    os.makedirs(os.path.dirname(events_path), exist_ok=True)
    with open(events_path, 'w', encoding='utf-8') as f:
        f.write(f"{events} $$$")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--tenant', required=True, help="Tenant folder name under tenants/, e.g. 'anabela'")
    args = parser.parse_args()
    main(args.tenant)