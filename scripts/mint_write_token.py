"""
One-off script: mint a Google Calendar token with read/write scope for a
tenant, separate from the read-only token used by google_calendar.py.

Run once locally:
    python scripts/mint_write_token.py --tenant anabela

Opens a browser for a fresh consent screen (new scope => new consent),
then writes tenants/<tenant>/token_write.json (gitignored). Copy the
"refresh_token" field from that file into the booking site's
GOOGLE_REFRESH_TOKEN Vercel env var, then this local file is no longer
needed (kept only as an optional local backup).
"""
import argparse
import json
import os

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/calendar']

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main(tenant):
    config_path = os.path.join(BASE_DIR, 'tenants', tenant, 'config.json')
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    credentials_path = os.path.join(BASE_DIR, config['google_credentials_path'])
    out_path = os.path.join(BASE_DIR, 'tenants', tenant, 'token_write.json')

    flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
    creds = flow.run_local_server(port=0)

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(creds.to_json())

    print(f"Wrote {out_path}")
    print("Copy the 'refresh_token' field into the booking-site Vercel project's")
    print("GOOGLE_REFRESH_TOKEN env var (production only).")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--tenant', required=True)
    args = parser.parse_args()
    main(args.tenant)
