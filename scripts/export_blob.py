"""Dump the Streamlit app's Google Sheets record to blob.json, for scripts/import-blob.ts.

Run it from the old Streamlit project folder, which has .streamlit/secrets.toml:
    pip install gspread google-auth
    python export_blob.py            # writes blob.json next to this script
Read-only: nothing in the Sheet is changed.
"""
import json
import pathlib
import tomllib

import gspread
from google.oauth2.service_account import Credentials

secrets = tomllib.loads(pathlib.Path(".streamlit/secrets.toml").read_text())
creds = Credentials.from_service_account_info(
    secrets["gcp_service_account"], scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
ws = gspread.authorize(creds).open(secrets["sheet"]["name"]).worksheet("susu_data")

parts = []
for v in ws.col_values(1):          # chunks run down column A until the first empty cell
    if not v:
        break
    parts.append(v)
blob = json.loads("".join(parts))    # fails loudly if the record is damaged
out = pathlib.Path(__file__).with_name("blob.json")
out.write_text(json.dumps(blob, ensure_ascii=False, indent=1))
print(f"Wrote {out} · rev {blob.get('rev')} · {len(blob.get('payment_transactions', []))} payments")
