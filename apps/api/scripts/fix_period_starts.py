#!/usr/bin/env python3
"""Align ongoing maintenance-period start dates with the VAN CSV.

Symptom: an in-maintenance vehicle's detail page shows
"No work logged for this period" even though the current repair IS logged.

Cause: the period's start_date / vehicle.maintenance_since was set to the
replacement date (VAN CSV col J) instead of the earlier repair date (col O).
The current repair log is dated at col O, so it falls just before the period
and gets hidden. import_fleet.py already computes the correct start as
min(replacement_date, repair_date); this backfills databases seeded before
that fix (e.g. production) without a destructive re-import.

This recomputes the correct start = min(repl_date J, maint_date O) from the CSV
and, where the current period starts LATER than that, moves the period start and
vehicle.maintenance_since back to it. Only ever moves a start EARLIER.

Dry run by default; set APPLY=1 to write.

  DATABASE_URL="postgres://..." python3 fix_period_starts.py          # dry run
  APPLY=1 DATABASE_URL="postgres://..." python3 fix_period_starts.py  # write
"""
import os
import sys
import csv

# Import the shared parsing helpers from the sibling import script.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg2
from import_fleet import parse_date, clean_plate, is_real_plate, col

CSV_PATH = os.environ.get(
    "FLEET_CSV", "/Users/giorgoskefalakis/Downloads/Motorcycle Fleet -   VAN (3).csv"
)
DB_URL = os.environ.get(
    "DATABASE_URL", "postgresql://giorgoskefalakis@localhost:5432/logistics"
)
APPLY = os.environ.get("APPLY") == "1"

# ── Correct start date per in-maintenance plate, from the CSV ────────────────
correct_start = {}   # plate -> date
with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
    for row in list(csv.reader(f))[1:]:
        plate_raw = col(row, 1)
        if not plate_raw:
            continue
        plate = clean_plate(plate_raw)
        if len(plate) < 3:
            continue
        repl_raw = col(row, 8)
        if not (repl_raw.lower() == "service" or is_real_plate(repl_raw)):
            continue  # not in maintenance per the sheet
        repl_date = parse_date(col(row, 9))    # J
        maint_date = parse_date(col(row, 14))  # O
        candidates = [d for d in (repl_date, maint_date) if d]
        if candidates:
            correct_start[plate] = min(candidates)

# ── Compare against ongoing periods in the DB ────────────────────────────────
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
cur.execute("""
    SELECT v.id, v.license_plate, v.maintenance_since, p.id, p.start_date
    FROM vehicles v
    JOIN maintenance_periods p ON p.vehicle_id = v.id AND p.end_date IS NULL
    WHERE v.status = 'in_maintenance'
""")
rows = cur.fetchall()

changes = []
for vid, plate, since, pid, pstart in rows:
    want = correct_start.get(plate)
    if not want:
        continue
    # Only pull the start EARLIER (fixes the "log falls before period" case).
    if pstart and want < pstart:
        changes.append((vid, plate, pid, pstart, want, since))

print(f"In-maintenance vehicles with an ongoing period : {len(rows)}")
print(f"Periods starting later than the CSV repair date : {len(changes)}")
print()
print(f"{'plate':10} {'period_start -> new':28} {'maint_since -> new'}")
for vid, plate, pid, pstart, want, since in changes:
    print(f"{plate:10} {str(pstart)} -> {str(want):14} {str(since)} -> {want}")

if APPLY and changes:
    for vid, plate, pid, pstart, want, since in changes:
        cur.execute("UPDATE maintenance_periods SET start_date=%s WHERE id=%s", (want, pid))
        cur.execute("UPDATE vehicles SET maintenance_since=%s WHERE id=%s", (want, vid))
    conn.commit()
    print(f"\nAPPLIED {len(changes)} updates.")
else:
    print(f"\nDry run — no changes written. Set APPLY=1 to write.")

cur.close()
conn.close()
