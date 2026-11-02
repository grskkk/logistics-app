#!/usr/bin/env python3
"""Sync vehicle STATUS (operational <-> in_maintenance) from the latest workbook.

sync_workbook.py only adds new vehicles, logs and appointments -- it never
touches the status of a vehicle that's already in the database. This script
is the companion for that: it reads the "VAN" sheet's replacement column
(the same column import_fleet.py uses) and, for vehicles ALREADY in the
database, updates their status to match.

What it changes for a vehicle whose status needs to flip:
  -> in_maintenance : sets status, sets maintenance_since, opens a new
                       maintenance_periods row (only if one isn't already open)
  -> operational     : sets status, closes any open maintenance_periods row
                       (end_date = today), clears maintenance_since

It NEVER touches vehicles that aren't in the sheet, never deletes anything,
and never changes a vehicle whose status already matches the sheet.

Dry run by default (one transaction, rolled back) -- set APPLY=1 to write.

USAGE
  DATABASE_URL="postgresql://..." python3 sync_status.py "Motorcycle_Fleet.xlsx"
  APPLY=1 DATABASE_URL="postgresql://..." python3 sync_status.py "Motorcycle_Fleet.xlsx"

Needs: pip install psycopg2-binary openpyxl
"""
import os
import sys
import warnings
from datetime import date, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg2
from openpyxl import load_workbook

from import_fleet import clean_plate, is_real_plate
from import_fleet import parse_date as parse_date_str

warnings.filterwarnings("ignore")

DB_URL = os.environ.get("DATABASE_URL")
APPLY = os.environ.get("APPLY") == "1"
XLSX = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("WORKBOOK")

if not DB_URL:
    sys.exit("Set DATABASE_URL (refusing to guess a database).")
if not XLSX or not os.path.exists(XLSX):
    sys.exit("Pass the workbook path: python3 sync_status.py Motorcycle_Fleet.xlsx")

GR2LAT = str.maketrans("ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ", "ABEZHIKMNOPTYX")


def canon(p):
    return clean_plate(p).translate(GR2LAT)


def cell(row, i):
    try:
        return row[i]
    except IndexError:
        return None


def text(row, i):
    v = cell(row, i)
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def to_date(v):
    if isinstance(v, datetime):
        return v.date() if 1990 <= v.year <= 2100 else None
    if isinstance(v, date):
        return v if 1990 <= v.year <= 2100 else None
    if isinstance(v, str):
        d = parse_date_str(v)
        return d if d and 1990 <= d.year <= 2100 else None
    return None


print(f"Reading {XLSX} ...", flush=True)
wb = load_workbook(XLSX, read_only=True, data_only=True)
van_rows = list(wb["  VAN"].iter_rows(values_only=True))

conn = psycopg2.connect(DB_URL, sslmode="require" if "localhost" not in DB_URL and "127.0.0.1" not in DB_URL else "prefer")
cur = conn.cursor()

cur.execute("SELECT id, license_plate, status, archived FROM vehicles")
db_by_plate = {canon(p): (vid, status, archived) for vid, p, status, archived in cur.fetchall()}

to_maintenance, to_operational = [], []
not_in_db, archived_in_sheet, dupes_in_sheet = [], [], []
seen = set()

for row in van_rows[1:]:
    plate_raw = text(row, 1)
    if not plate_raw:
        continue
    plate = clean_plate(plate_raw)
    if len(plate) < 3:
        continue
    key = canon(plate)
    if key in seen:
        dupes_in_sheet.append(key)
        continue
    seen.add(key)

    match = db_by_plate.get(key)
    if not match:
        not_in_db.append(key)
        continue
    vid, db_status, archived = match
    if archived:
        archived_in_sheet.append(key)
        continue  # archived (history-only) vehicles are left alone

    repl_raw = text(row, 8)
    repl_is_service = repl_raw.lower() == "service"
    repl_is_plate = is_real_plate(repl_raw)
    sheet_in_maint = repl_is_plate or repl_is_service

    if sheet_in_maint and db_status != "in_maintenance":
        repl_date = to_date(cell(row, 9))
        maint_date = to_date(cell(row, 14))
        since_candidates = [d for d in (repl_date, maint_date) if d]
        maintenance_since = min(since_candidates) if since_candidates else None
        to_maintenance.append((vid, key, db_status, maintenance_since))
    elif not sheet_in_maint and db_status == "in_maintenance":
        to_operational.append((vid, key, db_status))
    # else: status already matches the sheet -- nothing to do

# ── apply (or just report, in dry-run) ────────────────────────────────────────
for vid, key, old_status, since in to_maintenance:
    cur.execute("UPDATE vehicles SET status='in_maintenance', maintenance_since=%s WHERE id=%s",
                (since, vid))
    cur.execute(
        """INSERT INTO maintenance_periods (vehicle_id, start_date)
           SELECT %s, COALESCE(%s, CURRENT_DATE)
           WHERE NOT EXISTS (
             SELECT 1 FROM maintenance_periods WHERE vehicle_id=%s AND end_date IS NULL
           )""",
        (vid, since, vid),
    )

for vid, key, old_status in to_operational:
    cur.execute("UPDATE vehicles SET status='operational', maintenance_since=NULL WHERE id=%s", (vid,))
    cur.execute(
        "UPDATE maintenance_periods SET end_date=CURRENT_DATE WHERE vehicle_id=%s AND end_date IS NULL",
        (vid,),
    )

if APPLY:
    conn.commit()
else:
    conn.rollback()

verb = "UPDATED" if APPLY else "would be updated"
print(f"\nDatabase host : {DB_URL.split('@')[-1].split('/')[0]}")
print(f"Mode          : {'APPLIED' if APPLY else 'DRY RUN (rolled back, nothing written)'}")

print(f"\n-> MARKED IN_MAINTENANCE: {len(to_maintenance)} {verb}")
for vid, key, old, since in to_maintenance:
    print(f"   {key:10} {old} -> in_maintenance   (since {since})")

print(f"\n-> MARKED OPERATIONAL: {len(to_operational)} {verb}")
for vid, key, old in to_operational:
    print(f"   {key:10} {old} -> operational")

print(f"\nUnchanged (status already matches the sheet): "
      f"{len(seen) - len(to_maintenance) - len(to_operational) - len(not_in_db) - len(archived_in_sheet)}")
print(f"Skipped, plate not in fleet (not added -- use sync_workbook.py for that): {len(not_in_db)}")
if not_in_db:
    print(f"   {', '.join(not_in_db[:20])}" + (" ..." if len(not_in_db) > 20 else ""))
print(f"Skipped, archived/history-only vehicles in the sheet (left alone): {len(archived_in_sheet)}")
print(f"Duplicate plates within the sheet (first occurrence used): {len(dupes_in_sheet)}")

if not APPLY:
    print("\nDry run only. Re-run with APPLY=1 to write.")

cur.close()
conn.close()
