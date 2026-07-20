#!/usr/bin/env python3
"""Import scheduled appointments (ραντεβού) from the VAN rantevou CSV.

Only rows that have BOTH a matching fleet vehicle AND a date become
appointments; the rest of the sheet is just a vehicle listing. Additive and
idempotent: skips an appointment that already exists for the same vehicle at
the same instant. Times are read as Europe/Athens local time.

Dry run by default; APPLY=1 to write.

  DATABASE_URL="postgres://..." python3 import_appointments.py
  APPLY=1 DATABASE_URL="postgres://..." python3 import_appointments.py
"""
import csv
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg2
from import_fleet import clean_plate

CSV_PATH = os.environ.get(
    "APPOINTMENTS_CSV", "/Users/giorgoskefalakis/Downloads/Motorcycle Fleet -    VAN rantevou (1).csv"
)
DB_URL = os.environ.get("DATABASE_URL", "postgresql://giorgoskefalakis@localhost:5432/logistics")
APPLY = os.environ.get("APPLY") == "1"
ATHENS = ZoneInfo("Europe/Athens")

# Greek license plates only use letters shared with Latin. The sheets mix the
# two alphabets (e.g. Greek "ΧΖΝ6148" vs stored Latin "XZN6148"), so canonicalise
# to Latin for matching.
GR2LAT = str.maketrans("ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ", "ABEZHIKMNOPTYX")


def canon(p):
    return clean_plate(p).translate(GR2LAT)


def col(row, i):
    try:
        return row[i].strip()
    except IndexError:
        return ""


def parse_dt(s):
    s = s.strip().strip('"')
    if not s:
        return None
    for fmt in ("%A, %B %d, %Y, %H:%M", "%A, %B %d, %Y %H:%M", "%B %d, %Y, %H:%M"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=ATHENS)
        except ValueError:
            pass
    return None


conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Make sure the table exists (a fresh environment may not have redeployed yet).
cur.execute("""
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      scheduled_at TIMESTAMPTZ NOT NULL,
      workshop TEXT,
      reason TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
""")
cur.execute("ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;")
conn.commit()

cur.execute("SELECT id, license_plate FROM vehicles")
exact_to_id, canon_to_id = {}, {}
for vid, plate in cur.fetchall():
    exact_to_id[clean_plate(plate)] = vid
    canon_to_id[canon(plate)] = vid


def lookup(plate_raw):
    return exact_to_id.get(clean_plate(plate_raw)) or canon_to_id.get(canon(plate_raw))


inserted = skipped_no_vehicle = skipped_no_date = skipped_dupe = defaulted_reason = 0
unmatched_with_date = []

with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
    rows = list(csv.reader(f))

for row in rows[1:]:
    plate_raw = col(row, 0)
    if not plate_raw:
        continue
    dt = parse_dt(col(row, 6))
    vehicle_id = lookup(plate_raw)

    if not vehicle_id:
        if dt:
            skipped_no_vehicle += 1
            unmatched_with_date.append(plate_raw)
        continue
    if not dt:
        skipped_no_date += 1
        continue

    workshop = col(row, 5) or None
    reason = col(row, 7)
    if not reason:
        reason = "Service"
        defaulted_reason += 1

    cur.execute(
        "SELECT 1 FROM appointments WHERE vehicle_id=%s AND scheduled_at=%s", (vehicle_id, dt)
    )
    if cur.fetchone():
        skipped_dupe += 1
        continue

    if APPLY:
        cur.execute(
            """INSERT INTO appointments (vehicle_id, scheduled_at, workshop, reason, status)
               VALUES (%s, %s, %s, %s, 'scheduled')""",
            (vehicle_id, dt, workshop, reason),
        )
    inserted += 1

if APPLY:
    conn.commit()

print(f"DB host                       : {DB_URL.split('@')[-1].split('/')[0]}")
print(f"Appointments {'INSERTED' if APPLY else 'to insert (dry run)'} : {inserted}")
print(f"  of which reason defaulted   : {defaulted_reason}")
print(f"Skipped (already exists)      : {skipped_dupe}")
print(f"Skipped (no appointment date) : {skipped_no_date}")
print(f"Skipped (date but no vehicle) : {skipped_no_vehicle}")
if unmatched_with_date:
    print(f"  unmatched plates w/ a date  : {', '.join(unmatched_with_date)}")
if not APPLY:
    print("\nDry run — nothing written. Set APPLY=1 to write.")

cur.close()
conn.close()
