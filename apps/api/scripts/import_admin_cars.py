#!/usr/bin/env python3
"""Add administrative (ΙΧ ΔΙΟΙΚΗΤΙΚΟ) cars to the fleet — plate, brand, model only.

The source sheet carries a lot of driver PII (names, emails, tax IDs, licence
numbers, phones); this deliberately imports ONLY the license plate, brand and
model, as type='car', so the vehicles exist as fleet records. Additive: a plate
already in the fleet (matched across Greek/Latin spellings) is left untouched.

Dry run by default; APPLY=1 to write.

  DATABASE_URL="postgres://..." python3 import_admin_cars.py
  APPLY=1 DATABASE_URL="postgres://..." python3 import_admin_cars.py
"""
import csv
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg2
from import_fleet import clean_plate

CSV_PATH = os.environ.get(
    "ADMIN_CARS_CSV", "/Users/giorgoskefalakis/Downloads/ΙΧ ΔΙΟΙΚΗΤΙΚΟ - Sheet1.csv"
)
DB_URL = os.environ.get("DATABASE_URL", "postgresql://giorgoskefalakis@localhost:5432/logistics")
APPLY = os.environ.get("APPLY") == "1"

GR2LAT = str.maketrans("ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ", "ABEZHIKMNOPTYX")


def canon(p):
    return clean_plate(p).translate(GR2LAT)


conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

cur.execute("SELECT license_plate FROM vehicles")
existing_exact, existing_canon = set(), set()
for (plate,) in cur.fetchall():
    existing_exact.add(clean_plate(plate))
    existing_canon.add(canon(plate))

with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
    rows = list(csv.reader(f))

added, skipped_existing = 0, 0
for row in rows[1:]:
    if not row or not row[0].strip():
        continue
    plate = clean_plate(row[0])
    brand = row[1].strip() or None
    model = row[2].strip() or None

    if plate in existing_exact or canon(plate) in existing_canon:
        skipped_existing += 1
        continue

    if APPLY:
        cur.execute(
            """INSERT INTO vehicles (license_plate, type, status, brand, model, archived)
               VALUES (%s, 'car', 'operational', %s, %s, FALSE)
               ON CONFLICT (license_plate) DO NOTHING""",
            (plate, brand, model),
        )
    # Guard against duplicate rows within the CSV itself.
    existing_exact.add(plate)
    existing_canon.add(canon(plate))
    added += 1
    print(f"  + {plate:12} {brand or '':10} {model or ''}")

if APPLY:
    conn.commit()

print(f"\nDB host                 : {DB_URL.split('@')[-1].split('/')[0]}")
print(f"Cars {'ADDED' if APPLY else 'to add (dry run)'} : {added}")
print(f"Skipped (already in fleet): {skipped_existing}")
if not APPLY:
    print("Dry run — nothing written. Set APPLY=1 to write.")

cur.close()
conn.close()
