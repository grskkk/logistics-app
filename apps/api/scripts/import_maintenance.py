#!/usr/bin/env python3
"""Import maintenance logs from Van maintenance report CSV.
Only imports logs for vehicles already in the database — no new vehicles created.
"""
import csv
import re
import psycopg2
from datetime import datetime

DB_URL = "postgresql://giorgoskefalakis@localhost:5432/logistics"
CSV_PATH = "/Users/giorgoskefalakis/Downloads/Motorcycle Fleet - Van maintenance report (1).csv"

REPAIR_MAP = {
    "Service": "Service",
    "Τακάκια/Φρένα": "Brakes",
    "Φανοποιία": "Bodywork",
    "DPF filter - Αναζωογόνηση": "DPF Filter",
    "Check engine": "Check Engine",
    "Αλλαγή ελαστικών": "Tire Change",
    "Μπαταρία": "Battery",
    "Ηλεκτρολογικό": "Electrical",
    "Μίζα": "Starter Motor",
    "Δίσκος συμπλέκτη": "Clutch Disc",
    "Συμπλέκτης": "Clutch",
    "Θραύση κρυστάλλου": "Windshield",
    "Ad-blue δοχείο-φίλτρο": "AdBlue Tank/Filter",
    "Ad-blue ένδειξη": "AdBlue Indicator",
    "Κόρνα": "Horn",
    "Ταινία τιμονιού": "Steering Column",
    "Κιβώτιο ταχυτήτων": "Gearbox",
    "Βάση Intercooler": "Intercooler Mount",
    "Βάση μοτέρ": "Engine Mount",
    "Ένδειξη λαδιών": "Oil Indicator",
    "Καταλύτης": "Catalytic Converter",
    "Γενικός έλεγχος": "General Check",
    "Άλλο": "Other",
    "αλλο": "Other",
    "Δείκτης καυσίμου": "Fuel Gauge",
    "A/C": "A/C",
    "Ψυγείο": "Radiator",
    "Δυναμό": "Alternator",
    "Βλάβη φόρτισης": "Charging Fault",
    "safe mode": "Safe Mode",
    "προβλημα καταλυτη": "Catalytic Converter",
}

def clean_plate(s):
    return re.sub(r'[\s\-]', '', s.strip().upper()) if s else None

def parse_date(s):
    if not s:
        return None
    s = s.strip().strip('"\'')
    for fmt in ["%B %d, %Y", "%b %d, %Y", "%B %d, %y", "%b %d, %y",
                "%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d"]:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None

def parse_km(s):
    if not s or not s.strip():
        return None
    try:
        return int(re.sub(r'[^\d]', '', s.strip()))
    except ValueError:
        return None

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

cur.execute("SELECT id, license_plate FROM vehicles WHERE archived = FALSE")
plate_to_id = {row[1]: row[0] for row in cur.fetchall()}

inserted = 0
skipped_no_vehicle = 0
skipped_no_date = 0
skipped_duplicate = 0

with open(CSV_PATH, encoding='utf-8-sig') as f:
    reader = csv.reader(f)
    next(reader)  # skip header

    for row in reader:
        if not row or not row[0].strip():
            continue

        plate = clean_plate(row[0])
        if not plate:
            continue

        vehicle_id = plate_to_id.get(plate)
        if not vehicle_id:
            skipped_no_vehicle += 1
            continue

        # Find where the summary section begins (plate value reappears mid-row)
        end_col = len(row)
        for i in range(6, len(row)):
            if clean_plate(row[i]) == plate:
                end_col = i
                break

        # Maintenance events start at col 6, each group is 6 cols wide
        for i in range(6, end_col - 4, 6):
            date_in_raw  = row[i].strip()     if i   < end_col else ""
            kms_raw      = row[i+1].strip()   if i+1 < end_col else ""
            workshop_raw = row[i+3].strip()   if i+3 < end_col else ""
            repair_raw   = row[i+4].strip()   if i+4 < end_col else ""
            notes_raw    = row[i+5].strip()   if i+5 < end_col else ""

            if not date_in_raw or not repair_raw:
                continue

            performed_at = parse_date(date_in_raw)
            if not performed_at:
                skipped_no_date += 1
                continue

            km_val = parse_km(kms_raw)
            service_type = REPAIR_MAP.get(repair_raw, repair_raw)
            workshop = workshop_raw or None
            notes = notes_raw or None

            # Skip duplicates
            cur.execute("""
                SELECT 1 FROM maintenance_logs
                WHERE vehicle_id = %s
                  AND performed_at::date = %s
                  AND service_type = %s
            """, (vehicle_id, performed_at, service_type))
            if cur.fetchone():
                skipped_duplicate += 1
                continue

            cur.execute("""
                INSERT INTO maintenance_logs
                    (vehicle_id, service_type, notes, performed_at, workshop, km_at_service)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (vehicle_id, service_type, notes, performed_at, workshop, km_val))
            inserted += 1

conn.commit()
cur.close()
conn.close()

print(f"Inserted:               {inserted}")
print(f"Skipped (no vehicle):   {skipped_no_vehicle}")
print(f"Skipped (no date):      {skipped_no_date}")
print(f"Skipped (duplicates):   {skipped_duplicate}")
