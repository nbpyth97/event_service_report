from __future__ import print_function
import datetime
import os.path
from annotated_types import doc
import requests
# import spacy

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']



def main(token_path='credential_token/token_anabela.json', credentials_path='credential_token/credentials_anabela.json'):
    creds = None
    token_path = f'{token_path}'

    # Load saved token
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    # If no valid credentials, log in
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                f'{credentials_path}', SCOPES)
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
    time_min = (datetime.datetime.utcnow() - datetime.timedelta(days=365*1)).isoformat() + 'Z'
    time_max = (datetime.datetime.utcnow() + datetime.timedelta(days=365*1)).isoformat() + 'Z'
    # time_min = (datetime.datetime.utcnow() - datetime.timedelta(days=0)).isoformat() + 'Z'
    # time_max = (datetime.datetime.utcnow() + datetime.timedelta(days=1)).isoformat() + 'Z'

    list_of_events = [] # that goes to the function 
    events = []

    page_token = None

    for cal in calendar_list['items']:

        # while True:
        events_result = service.events().list(
                calendarId=f"{cal['id']}",
                timeMin=time_min,
                timeMax=time_max,
                maxResults=250,
                singleEvents=True,
                orderBy='startTime',
                pageToken=page_token
            ).execute()

        events.extend(events_result.get('items', []))

        page_token = events_result.get('nextPageToken')

        events = sorted(
            events,
            key=lambda e: e['start'].get('dateTime') or e['start'].get('date'),
            reverse=True
        )
        
        print('write event')

        with open('events.txt', 'a', encoding='utf-8') as f:
            f.write(f"{events} $$$")


main()