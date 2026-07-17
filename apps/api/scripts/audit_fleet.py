#!/usr/bin/env python3
"""Read-only audit: compare the VAN CSV against the vehicles in the database.

Reuses import_fleet.py's own parsing so "expected" values match exactly what a
real import would write. Writes NOTHING — it only reports mismatches.

  python3 audit_fleet.py                        # audit the local database
  DATABASE_URL="postgres://..." python3 audit_fleet.py   # audit another env
"""
import os
import sys
import csv
from collections import Counter

# Import the shared parsing helpers from the sibling import script.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg2
from import_fleet import parse_date, clean_plate, is_real_plate, detect_fuel, col

CSV_PATH = os.environ.get(
    "FLEET_CSV", "/Users/giorgoskefalakis/Downloads/Motorcycle Fleet -   VAN (2).csv"
)
DB_URL = os.environ.get(
    "DATABASE_URL", "postgresql://giorgoskefalakis@localhost:5432/logistics"
)

# ── Build expected vehicles from the CSV (mirrors import_fleet.main) ──────────
expected = {}          # plate -> dict of fields
csv_dupes = []          # plates listed more than once (first wins, like ON CONFLICT DO NOTHING)

with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
    rows = list(csv.reader(f))

for row in rows[1:]:
    plate_raw = col(row, 1)
    if not plate_raw:
        continue
    plate = clean_plate(plate_raw)
    if len(plate) < 3:
        continue

    vtype = "car" if col(row, 4).lower() == "car" else "van"
    brand = col(row, 2) or None
    model = col(row, 3) or None
    lease_co_raw = col(row, 5).strip()
    lease_co = None if lease_co_raw in ("//", "") else (lease_co_raw or None)
    lease_start = parse_date(col(row, 6))
    hub = col(row, 7) or None

    repl_raw = col(row, 8)
    repl_is_service = repl_raw.lower() == "service"
    repl_is_plate = is_real_plate(repl_raw)
    status = "in_maintenance" if (repl_is_plate or repl_is_service) else "operational"

    rec = {
        "type": vtype, "status": status, "brand": brand, "model": model,
        "fuel_type": detect_fuel(model), "lease_start_date": lease_start,
        "lease_company": lease_co, "hub": hub,
    }
    if plate in expected:
        csv_dupes.append(plate)
        continue          # first occurrence wins
    expected[plate] = rec

# ── Load actual vehicles from the DB ─────────────────────────────────────────
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
cur.execute("""
    SELECT license_plate, type, status, brand, model, fuel_type,
           lease_start_date, lease_company, hub, archived
    FROM vehicles
""")
cols = ["type", "status", "brand", "model", "fuel_type",
        "lease_start_date", "lease_company", "hub"]
actual = {}
archived = set()
for r in cur.fetchall():
    plate = r[0]
    if r[9]:  # archived
        archived.add(plate)
    actual[plate] = dict(zip(cols, r[1:9]))
cur.close(); conn.close()

# ── Compare ──────────────────────────────────────────────────────────────────
exp_plates = set(expected)
act_plates = set(actual)

missing = sorted(exp_plates - act_plates)          # in CSV, not in DB
extra = sorted(act_plates - exp_plates)            # in DB, not in CSV

field_mismatches = {}                               # plate -> list of (field, expected, actual)
for plate in sorted(exp_plates & act_plates):
    e, a = expected[plate], actual[plate]
    diffs = []
    for c in cols:
        ev, av = e[c], a[c]
        if c == "lease_start_date":
            av = av.isoformat() if av else None
            ev = ev.isoformat() if ev else None
        # normalise blank/None
        ev = ev if ev not in ("", None) else None
        av = av if av not in ("", None) else None
        if ev != av:
            diffs.append((c, ev, av))
    if diffs:
        field_mismatches[plate] = diffs

# ── Report ───────────────────────────────────────────────────────────────────
print(f"DB URL host       : {DB_URL.split('@')[-1].split('/')[0]}")
print(f"CSV vehicles      : {len(expected)}  (unique plates; {len(csv_dupes)} duplicate rows ignored)")
print(f"DB vehicles       : {len(actual)}  ({len(archived)} archived)")
print()
print(f"── In CSV but MISSING from DB: {len(missing)} ──")
for p in missing:
    print(f"   {p}  (expected status={expected[p]['status']}, {expected[p]['brand']} {expected[p]['model']})")
print()
print(f"── In DB but NOT in CSV: {len(extra)} ──")
for p in extra:
    tag = " [archived]" if p in archived else ""
    print(f"   {p}{tag}  db status={actual[p]['status']}, {actual[p]['brand']} {actual[p]['model']}")
print()
print(f"── Field mismatches: {len(field_mismatches)} vehicles ──")
field_counter = Counter()
for diffs in field_mismatches.values():
    for (c, _, _) in diffs:
        field_counter[c] += 1
for c, n in field_counter.most_common():
    print(f"   {c}: {n}")
print()
# Show the actual diffs (cap output)
shown = 0
for plate, diffs in field_mismatches.items():
    if shown >= 40:
        print(f"   ... and {len(field_mismatches) - shown} more vehicles")
        break
    for (c, ev, av) in diffs:
        print(f"   {plate}  {c}: CSV={ev!r}  DB={av!r}")
    shown += 1
