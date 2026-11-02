#!/usr/bin/env python3
"""Additively sync the Motorcycle Fleet workbook into the Vanakias database.

Reads the .xlsx directly (no CSV export needed) and does three things, in order:

  1. VEHICLES      sheet "VAN"                    -> plates not yet in the fleet
  2. MAINTENANCE   sheet "Van maintenance report" -> logs that don't exist yet
  3. APPOINTMENTS  sheet "VAN rantevou"           -> appointments that don't exist yet

SAFE BY DESIGN
  * Never deletes or overwrites anything. Existing vehicles are left untouched.
    (Unlike import_fleet.py, which wipes the tables first -- do NOT use that on prod.)
  * The only change to an existing row is back-filling an empty "date out"
    (returned_at) on a maintenance log, same as import_maintenance.py does.
  * Idempotent: running it twice adds nothing the second time.
  * Plates are matched across Greek/Latin lookalike letters (e.g. ΧΖΝ6148 == XZN6148).
  * Dry run by default: everything is executed inside one transaction and then
    rolled back, so the counts are exactly what APPLY=1 would write.

OPTIONAL
  ADD_RETURNED=1   also store vehicles that only appear in the maintenance report
                   (already returned to leasing) as archived, so their logs import too.

USAGE
  DATABASE_URL="postgresql://..." python3 sync_workbook.py "Motorcycle_Fleet.xlsx"
  APPLY=1 DATABASE_URL="postgresql://..." python3 sync_workbook.py "Motorcycle_Fleet.xlsx"

Needs: pip install psycopg2-binary openpyxl
"""
import os
import re
import sys
import warnings
from datetime import date, datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg2
from openpyxl import load_workbook

# Reuse the project's own parsing helpers so values match a normal import.
from import_fleet import clean_plate, detect_fuel, is_real_plate
from import_fleet import parse_date as parse_date_str

warnings.filterwarnings("ignore")  # openpyxl warns about junk date serials in the sheet

DB_URL = os.environ.get("DATABASE_URL")
APPLY = os.environ.get("APPLY") == "1"
XLSX = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("WORKBOOK")
ATHENS = ZoneInfo("Europe/Athens")

if not DB_URL:
    sys.exit("Set DATABASE_URL (refusing to guess a database).")
if not XLSX or not os.path.exists(XLSX):
    sys.exit("Pass the workbook path: python3 sync_workbook.py Motorcycle_Fleet.xlsx")

# Greek letters that look like Latin ones -> Latin (license plates only use these).
GR2LAT = str.maketrans("ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ", "ABEZHIKMNOPTYX")


def canon(p):
    return clean_plate(p).translate(GR2LAT)


# Same translations as import_maintenance.py
REPAIR_MAP = {
    "Service": "Service", "Τακάκια/Φρένα": "Brakes", "Φανοποιία": "Bodywork",
    "DPF filter - Αναζωογόνηση": "DPF Filter", "Check engine": "Check Engine",
    "Αλλαγή ελαστικών": "Tire Change", "Μπαταρία": "Battery",
    "Ηλεκτρολογικό": "Electrical", "Μίζα": "Starter Motor",
    "Δίσκος συμπλέκτη": "Clutch Disc", "Συμπλέκτης": "Clutch",
    "Θραύση κρυστάλλου": "Windshield", "Ad-blue δοχείο-φίλτρο": "AdBlue Tank/Filter",
    "Ad-blue ένδειξη": "AdBlue Indicator", "Κόρνα": "Horn",
    "Ταινία τιμονιού": "Steering Column", "Κιβώτιο ταχυτήτων": "Gearbox",
    "Βάση Intercooler": "Intercooler Mount", "Βάση μοτέρ": "Engine Mount",
    "Ένδειξη λαδιών": "Oil Indicator", "Καταλύτης": "Catalytic Converter",
    "Γενικός έλεγχος": "General Check", "Άλλο": "Other", "αλλο": "Other",
    "Δείκτης καυσίμου": "Fuel Gauge", "A/C": "A/C", "Ψυγείο": "Radiator",
    "Δυναμό": "Alternator", "Βλάβη φόρτισης": "Charging Fault",
    "safe mode": "Safe Mode", "προβλημα καταλυτη": "Catalytic Converter",
}
REVERSE_MAP = {}
for _raw, _en in REPAIR_MAP.items():
    REVERSE_MAP.setdefault(_en, set()).add(_raw)
REVERSE_MAP["Tire Change"].add("Αλλαγή Ελαστικών")


# ── cell helpers (workbook cells are real datetimes/numbers, not strings) ─────

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


def to_km(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return int(v)
    digits = re.sub(r"[^0-9]", "", str(v))
    return int(digits) if digits else None


def find_sheet(wb, wanted):
    for ws in wb.worksheets:
        if ws.title.strip().lower() == wanted.lower():
            return ws
    sys.exit(f'Sheet "{wanted}" not found. Sheets: {wb.sheetnames}')


# ── load workbook ─────────────────────────────────────────────────────────────
print(f"Reading {XLSX} ...", flush=True)
wb = load_workbook(XLSX, read_only=True, data_only=True)
van_rows = list(find_sheet(wb, "VAN").iter_rows(values_only=True))
maint_rows = list(find_sheet(wb, "Van maintenance report").iter_rows(values_only=True))
appt_rows = list(find_sheet(wb, "VAN rantevou").iter_rows(values_only=True))

conn = psycopg2.connect(DB_URL, sslmode="require" if "localhost" not in DB_URL and "127.0.0.1" not in DB_URL else "prefer")
cur = conn.cursor()

# plate (canonical Latin) -> vehicle id, for everything already in the fleet
cur.execute("SELECT id, license_plate FROM vehicles")
plate_to_id = {canon(p): vid for vid, p in cur.fetchall()}
fleet_before = len(plate_to_id)

# ══ 1. NEW VEHICLES ═══════════════════════════════════════════════════════════
new_vehicles, new_in_maint, new_repl = [], 0, 0
skipped_existing = skipped_dup_in_sheet = 0
seen_in_sheet = set()

for row in van_rows[1:]:
    plate_raw = text(row, 1)
    if not plate_raw:
        continue
    plate = clean_plate(plate_raw)
    if len(plate) < 3:
        continue
    key = canon(plate)
    if key in seen_in_sheet:
        skipped_dup_in_sheet += 1
        continue
    seen_in_sheet.add(key)
    if key in plate_to_id:
        skipped_existing += 1
        continue

    brand = text(row, 2) or None
    model = text(row, 3) or None
    vtype = "car" if text(row, 4).lower() in ("car", "ix", "ιχ") else "van"
    lease_co = text(row, 5)
    lease_co = None if lease_co in ("", "//") else lease_co
    lease_start = to_date(cell(row, 6))
    hub = text(row, 7) or None

    repl_raw = text(row, 8)
    repl_is_service = repl_raw.lower() == "service"
    repl_is_plate = is_real_plate(repl_raw)
    repl_date = to_date(cell(row, 9))
    maint_date = to_date(cell(row, 14))
    return_date = to_date(cell(row, 15))
    notes = text(row, 17) or None

    if repl_is_plate or repl_is_service:
        status = "in_maintenance"
        since = [d for d in (repl_date, maint_date) if d]
        maintenance_since = min(since) if since else None
    else:
        status, maintenance_since = "operational", None

    cur.execute(
        """INSERT INTO vehicles
             (license_plate, type, status, brand, model, fuel_type,
              lease_start_date, lease_company, hub, archived, maintenance_since)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,FALSE,%s)
           ON CONFLICT (license_plate) DO NOTHING RETURNING id""",
        (key, vtype, status, brand, model, detect_fuel(model),
         lease_start, lease_co, hub, maintenance_since),
    )
    res = cur.fetchone()
    if not res:
        skipped_existing += 1
        continue
    vid = res[0]
    plate_to_id[key] = vid
    new_vehicles.append((key, brand, model, status))

    if status == "in_maintenance":
        new_in_maint += 1
        cur.execute(
            "INSERT INTO maintenance_periods (vehicle_id, start_date) VALUES (%s, COALESCE(%s, CURRENT_DATE))",
            (vid, maintenance_since),
        )
    if repl_is_plate and repl_date:
        cur.execute(
            """INSERT INTO replacement_vehicles
                 (vehicle_id, license_plate, brand, model, start_date, end_date, lease_company, notes)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
            (vid, canon(repl_raw), text(row, 10) or None, text(row, 11) or None,
             repl_date, return_date, lease_co, notes),
        )
        new_repl += 1

# ══ 1b. (opt-in) RETURNED VEHICLES ════════════════════════════════════════════
# The maintenance report also holds history for vehicles that are no longer in the
# VAN sheet (returned to the leasing company). With ADD_RETURNED=1 they are stored
# as ARCHIVED vehicles so their logs have somewhere to live. Off by default.
ADD_RETURNED = os.environ.get("ADD_RETURNED") == "1"
returned_added = []
report_only = {}
for row in maint_rows[1:]:
    plate_raw = text(row, 0)
    if plate_raw and canon(plate_raw) not in plate_to_id and canon(plate_raw) not in report_only:
        report_only[canon(plate_raw)] = row
if ADD_RETURNED:
    for key, row in report_only.items():
        lease = text(row, 3)
        lease = None if lease in ("", "#N/A", "//") else lease
        cur.execute(
            """INSERT INTO vehicles (license_plate, type, status, brand, model, fuel_type,
                                      lease_start_date, lease_company, archived)
               VALUES (%s,'van','operational',%s,%s,%s,%s,%s,TRUE)
               ON CONFLICT (license_plate) DO NOTHING RETURNING id""",
            (key, text(row, 1) or None, text(row, 2) or None, detect_fuel(text(row, 2)),
             to_date(cell(row, 4)), lease),
        )
        res = cur.fetchone()
        if res:
            plate_to_id[key] = res[0]
            returned_added.append(key)

# ══ 2. MAINTENANCE LOGS ═══════════════════════════════════════════════════════
# Build candidate events: (plate_key, performed_at, returned_at, km, workshop, service_type, notes)
events = []
bad_dates = 0

# 2a. "Van maintenance report": groups of 6 columns starting at col 6, ending where
#     the plate reappears (the sheet's summary block).
for row in maint_rows[1:]:
    plate_raw = text(row, 0)
    if not plate_raw:
        continue
    key = canon(plate_raw)
    end_col = len(row)
    for i in range(6, len(row)):
        if text(row, i) and canon(text(row, i)) == key:
            end_col = i
            break
    for i in range(6, end_col - 4, 6):
        repair_raw = text(row, i + 4)
        if cell(row, i) in (None, "") or not repair_raw:
            continue
        performed = to_date(cell(row, i))
        if not performed:
            if isinstance(cell(row, i), (str, date)):  # numbers here are summary-block noise
                bad_dates += 1
            continue
        events.append((key, performed, to_date(cell(row, i + 2)), to_km(cell(row, i + 1)),
                       text(row, i + 3) or None,
                       REPAIR_MAP.get(repair_raw, repair_raw), text(row, i + 5) or None))

# 2b. The current repair / tire change recorded on the VAN sheet itself.
#     (Folded into the same de-dupe, so it never duplicates the report.)
for row in van_rows[1:]:
    plate_raw = text(row, 1)
    if not plate_raw or len(clean_plate(plate_raw)) < 3:
        continue
    key = canon(plate_raw)
    maint_date, stype = to_date(cell(row, 14)), text(row, 16)
    if maint_date and stype:
        events.append((key, maint_date, to_date(cell(row, 15)), to_km(cell(row, 13)),
                       text(row, 12) or None, REPAIR_MAP.get(stype, stype), text(row, 17) or None))
    if cell(row, 20) is True and to_date(cell(row, 22)):
        events.append((key, to_date(cell(row, 22)), None, to_km(cell(row, 21)),
                       None, "Tire Change", None))

logs_inserted = logs_backfilled = logs_dupe = logs_no_vehicle = 0
no_vehicle_plates = set()
for key, performed, returned, km, workshop, stype, notes in events:
    vid = plate_to_id.get(key)
    if not vid:
        logs_no_vehicle += 1
        no_vehicle_plates.add(key)
        continue
    labels = list({stype} | REVERSE_MAP.get(stype, set()))
    cur.execute(
        """SELECT id, returned_at FROM maintenance_logs
           WHERE vehicle_id = %s AND performed_at::date = %s AND service_type = ANY(%s)""",
        (vid, performed, labels),
    )
    existing = cur.fetchone()
    if existing:
        log_id, existing_returned = existing
        if returned and not existing_returned:
            cur.execute("UPDATE maintenance_logs SET returned_at = %s WHERE id = %s", (returned, log_id))
            logs_backfilled += 1
        else:
            logs_dupe += 1
        continue
    cur.execute(
        """INSERT INTO maintenance_logs
             (vehicle_id, service_type, notes, performed_at, returned_at, workshop, km_at_service)
           VALUES (%s,%s,%s,%s,%s,%s,%s)""",
        (vid, stype, notes, performed, returned, workshop, km),
    )
    logs_inserted += 1

# ══ 3. APPOINTMENTS ═══════════════════════════════════════════════════════════
cur.execute("""
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      scheduled_at TIMESTAMPTZ NOT NULL,
      workshop TEXT, reason TEXT NOT NULL, notes TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )""")

appts_inserted = appts_dupe = appts_defaulted = 0
appts_unmatched = []
appt_details = []
for row in appt_rows[1:]:
    plate_raw = text(row, 0)
    when = cell(row, 6)
    if not plate_raw or not isinstance(when, datetime):
        continue  # most rows are just a vehicle listing with no appointment
    when = when.replace(tzinfo=ATHENS)  # sheet times are Athens local time
    vid = plate_to_id.get(canon(plate_raw))
    if not vid:
        appts_unmatched.append(plate_raw)
        continue
    reason = text(row, 7)
    if not reason:
        reason, appts_defaulted = "Service", appts_defaulted + 1
    cur.execute("SELECT 1 FROM appointments WHERE vehicle_id=%s AND scheduled_at=%s", (vid, when))
    if cur.fetchone():
        appts_dupe += 1
        continue
    cur.execute(
        """INSERT INTO appointments (vehicle_id, scheduled_at, workshop, reason, status)
           VALUES (%s,%s,%s,%s,'scheduled')""",
        (vid, when, text(row, 5) or None, reason),
    )
    appts_inserted += 1
    appt_details.append(f"{canon(plate_raw)}  {when:%d %b %Y %H:%M}  {text(row, 5)}  — {reason}")

# ── commit or roll back ───────────────────────────────────────────────────────
if APPLY:
    conn.commit()
else:
    conn.rollback()

verb = "ADDED" if APPLY else "would be added"
print(f"\nDatabase host : {DB_URL.split('@')[-1].split('/')[0]}")
print(f"Mode          : {'APPLIED' if APPLY else 'DRY RUN (rolled back, nothing written)'}")
print(f"Fleet before  : {fleet_before} vehicles\n")

print(f"1. VEHICLES — {len(new_vehicles)} {verb}")
print(f"   ({new_in_maint} in maintenance, {new_repl} replacement vehicles linked; "
      f"{skipped_existing} already in fleet, {skipped_dup_in_sheet} duplicate rows in sheet ignored)")
for p, b, m, s in new_vehicles[:60]:
    print(f"   + {p:10} {b or '':10} {(m or '')[:40]:40} {s}")
if len(new_vehicles) > 60:
    print(f"   ... and {len(new_vehicles) - 60} more")

if ADD_RETURNED:
    print(f"\n1b. RETURNED VEHICLES — {len(returned_added)} {verb} as ARCHIVED (history-only records)")
else:
    print(f"\n1b. RETURNED VEHICLES — {len(report_only)} plates appear only in the maintenance report "
          f"(not added; set ADD_RETURNED=1 to store them as archived so their logs import)")

print(f"\n2. MAINTENANCE LOGS — {logs_inserted} {verb}")
print(f"   {logs_backfilled} existing logs got a missing 'date out' filled in")
print(f"   {logs_dupe} already present (skipped)")
print(f"   {logs_no_vehicle} skipped: plate not in fleet ({len(no_vehicle_plates)} plates)"
      + (f": {', '.join(sorted(no_vehicle_plates)[:15])}" if no_vehicle_plates else ""))
print(f"   {bad_dates} skipped: unreadable date")

print(f"\n3. APPOINTMENTS — {appts_inserted} {verb}  ({appts_dupe} already present)")
for d in appt_details:
    print(f"   + {d}")
if appts_unmatched:
    print(f"   Skipped, plate not in fleet: {', '.join(appts_unmatched)}")

if not APPLY:
    print("\nDry run only. Re-run with APPLY=1 to write.")

cur.close()
conn.close()
