#!/usr/bin/env python3
"""Import fleet data from CSV into the logistics database."""

import csv
import re
import sys
from datetime import datetime, date

import psycopg2

CSV_PATH = "/Users/giorgoskefalakis/Downloads/Motorcycle Fleet -   VAN.csv"
DB_URL = "postgresql://giorgoskefalakis@localhost:5432/logistics"

TODAY = date.today()


# ── Date parsing ─────────────────────────────────────────────────────────────

def parse_date(raw: str) -> date | None:
    if not raw:
        return None
    s = raw.strip()
    if not s:
        return None

    # Kill anything after a space that looks like notes (Greek lowercase)
    s = re.split(r'\s+(?=[α-ωά-ώΑ-Ωά-ώa-z].*)', s)[0].strip()
    # Remove parenthetical suffixes like "(χ)"
    s = re.sub(r'\s*\(.*', '', s).strip()

    # Fix 5-digit years: "12024" → "2024"
    s = re.sub(r'(\d{1,2}/\d{1,2}/)(\d{5,})', lambda m: m.group(1) + m.group(2)[-4:], s)

    # Named month formats
    for fmt in ('%B %d, %Y', '%b %d, %Y', '%b %Y', '%B %Y', '%b. %d, %Y', '%B %d %Y'):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass

    # "Feb 19, 2026" with abbreviated month
    try:
        return datetime.strptime(s, '%b %d, %Y').date()
    except ValueError:
        pass

    # Numeric: split on / or -
    parts = re.split(r'[/\-]', s)
    if len(parts) == 3:
        try:
            a, b, c = [p.strip() for p in parts]
            ai, bi, ci = int(a), int(b), int(c)
            if ci < 100:
                ci += 2000
            # Detect D/M/Y vs M/D/Y
            if ai > 12:
                return date(ci, bi, ai)  # D/M/Y
            elif bi > 12:
                return date(ci, ai, bi)  # M/D/Y
            else:
                return date(ci, bi, ai)  # Assume D/M/Y (Greek)
        except (ValueError, TypeError):
            return None

    return None


# ── Plate normalisation ───────────────────────────────────────────────────────

def clean_plate(s: str) -> str:
    return s.strip().upper().replace(' ', '').replace('-', '')


def is_real_plate(s: str) -> bool:
    """Return True if the field looks like a license plate, not a note."""
    if not s:
        return False
    stripped = s.strip()
    if stripped.lower() == 'service':
        return False
    cleaned = stripped.replace(' ', '')
    # Notes contain lowercase letters (Greek notes have lowercase)
    if any(c.islower() for c in cleaned):
        return False
    return 4 <= len(cleaned) <= 12


# ── Fuel type detection ───────────────────────────────────────────────────────

ELECTRIC_KW = [
    'electric', 'bev', 'kwh', ' ev ', 'edeliver', 'etp',
    'e-vivaro', 'e-jumpy', 'e-partner', 'e-berlingo', 'e-combo',
    'e vivaro', 'e proace', 'e-proace', 'nv 200', 'e  van', 'e van',
    'e expert', 'e-expert', '75kw', 'townstar', 'deliver3', 'edeliver3',
]
DIESEL_KW = [
    'diesel', 'tdi', 'hdi', 'bhdi', 'bluehdi', 'blue hd', '2.2d',
    '1.5d', 'cdti', '2.0 tdi', 'express', 's&s', 'bluehdì',
]


def detect_fuel(model: str) -> str | None:
    if not model:
        return None
    m = re.sub(r'\s+', ' ', model.lower())
    for kw in ELECTRIC_KW:
        if kw in m:
            return 'electric'
    for kw in DIESEL_KW:
        if kw in m:
            return 'diesel'
    return None


# ── Safe column access ────────────────────────────────────────────────────────

def col(row: list, idx: int, default='') -> str:
    try:
        return row[idx].strip() if row[idx] else default
    except IndexError:
        return default


# ── Main import ───────────────────────────────────────────────────────────────

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    print("Clearing existing test data...")
    cur.execute("UPDATE drivers SET vehicle_id = NULL")
    cur.execute("DELETE FROM replacement_vehicles")
    cur.execute("DELETE FROM maintenance_logs")
    cur.execute("DELETE FROM vehicles")
    conn.commit()

    with open(CSV_PATH, newline='', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        rows = list(reader)

    # Skip header row
    data_rows = rows[1:]

    vehicles_added = 0
    replacements_added = 0
    maint_added = 0
    skipped = 0

    for row in data_rows:
        plate_raw = col(row, 1)
        if not plate_raw:
            continue

        plate = clean_plate(plate_raw)
        if len(plate) < 3:
            continue

        brand = col(row, 2) or None
        model = col(row, 3) or None
        vtype_raw = col(row, 4).lower()
        vtype = 'car' if vtype_raw == 'car' else 'van'

        lease_co_raw = col(row, 5).strip()
        if lease_co_raw in ('//', ''):
            lease_co = None
        else:
            lease_co = lease_co_raw.strip() or None

        lease_start = parse_date(col(row, 6))
        hub = col(row, 7) or None

        repl_raw = col(row, 8)
        repl_is_service = repl_raw.lower() == 'service'
        repl_is_plate = is_real_plate(repl_raw)

        repl_date = parse_date(col(row, 9))
        repl_brand = col(row, 10) or None
        repl_model = col(row, 11) or None
        workshop = col(row, 12) or None

        km_raw = col(row, 13)
        km_val = None
        if km_raw:
            try:
                km_val = int(re.sub(r'[^0-9]', '', km_raw))
            except (ValueError, TypeError):
                pass

        maint_date = parse_date(col(row, 14))
        return_date = parse_date(col(row, 15))
        service_type = col(row, 16) or None
        notes = col(row, 17) or None

        tire_change = col(row, 20).upper() == 'TRUE'
        tire_km_raw = col(row, 21)
        tire_km = None
        if tire_km_raw:
            try:
                tire_km = int(re.sub(r'[^0-9]', '', tire_km_raw))
            except (ValueError, TypeError):
                pass
        tire_date = parse_date(col(row, 22))

        # Last two columns: extra repair info
        last_col = col(row, -1) if len(row) >= 1 else ''
        second_last = col(row, -2) if len(row) >= 2 else ''
        # Avoid reading from cols that aren't the actual last columns
        # (only use last two if they're not the same as earlier cols)
        extra_workshop = None
        extra_service = None
        tire_workshop = None

        if tire_change and not second_last and last_col and last_col != workshop:
            tire_workshop = last_col
        elif second_last and last_col and len(row) > 22:
            extra_service = second_last
            extra_workshop = last_col

        # Determine vehicle status
        active_replacement = repl_is_plate and not return_date
        in_service_no_repl = (repl_is_service or (not repl_is_plate and extra_workshop and not tire_change))

        if active_replacement or in_service_no_repl:
            status = 'in_maintenance'
        else:
            status = 'operational'

        fuel_type = detect_fuel(model)

        # Insert vehicle
        try:
            cur.execute(
                """
                INSERT INTO vehicles
                  (license_plate, type, status, brand, model, fuel_type,
                   lease_start_date, lease_company, hub, archived)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,FALSE)
                ON CONFLICT (license_plate) DO NOTHING
                RETURNING id
                """,
                (plate, vtype, status, brand, model, fuel_type,
                 lease_start, lease_co, hub)
            )
            result = cur.fetchone()
            if result is None:
                skipped += 1
                continue
            vehicle_id = result[0]
            vehicles_added += 1
        except Exception as e:
            print(f"  Error inserting {plate}: {e}")
            conn.rollback()
            continue

        # Insert active replacement vehicle
        if repl_is_plate and repl_date:
            repl_plate = clean_plate(repl_raw)
            try:
                cur.execute(
                    """
                    INSERT INTO replacement_vehicles
                      (vehicle_id, license_plate, brand, model, start_date,
                       end_date, lease_company, notes)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (vehicle_id, repl_plate, repl_brand, repl_model,
                     repl_date, return_date, lease_co, notes)
                )
                replacements_added += 1
            except Exception as e:
                print(f"  Error inserting replacement for {plate}: {e}")

        # Main maintenance log
        if maint_date and service_type:
            try:
                cur.execute(
                    """
                    INSERT INTO maintenance_logs
                      (vehicle_id, service_type, notes, performed_at,
                       workshop, km_at_service)
                    VALUES (%s,%s,%s,%s,%s,%s)
                    """,
                    (vehicle_id, service_type, notes, maint_date,
                     workshop, km_val)
                )
                maint_added += 1
            except Exception as e:
                print(f"  Error inserting maintenance for {plate}: {e}")
        elif repl_is_service and workshop:
            # "service" in replacement col — vehicle is in workshop, no replacement
            try:
                cur.execute(
                    """
                    INSERT INTO maintenance_logs
                      (vehicle_id, service_type, notes, performed_at,
                       workshop, km_at_service)
                    VALUES (%s,%s,%s,%s,%s,%s)
                    """,
                    (vehicle_id, service_type or 'Συντήρηση', notes,
                     maint_date or TODAY, workshop, km_val)
                )
                maint_added += 1
            except Exception as e:
                print(f"  Error inserting service for {plate}: {e}")

        # Tire change maintenance log
        if tire_change and tire_date:
            try:
                cur.execute(
                    """
                    INSERT INTO maintenance_logs
                      (vehicle_id, service_type, notes, performed_at,
                       workshop, km_at_service)
                    VALUES (%s,%s,%s,%s,%s,%s)
                    """,
                    (vehicle_id, 'Αλλαγή Ελαστικών', None,
                     tire_date, tire_workshop, tire_km)
                )
                maint_added += 1
            except Exception as e:
                print(f"  Error inserting tire change for {plate}: {e}")

        # Extra workshop entry (last two columns, not tire-related)
        if extra_service and extra_workshop and extra_workshop != workshop:
            try:
                cur.execute(
                    """
                    INSERT INTO maintenance_logs
                      (vehicle_id, service_type, notes, performed_at, workshop)
                    VALUES (%s,%s,%s,%s,%s)
                    """,
                    (vehicle_id, extra_service, None, TODAY, extra_workshop)
                )
                maint_added += 1
            except Exception as e:
                print(f"  Error inserting extra maintenance for {plate}: {e}")

    conn.commit()
    cur.close()
    conn.close()

    print(f"\n✓ Done.")
    print(f"  Vehicles imported : {vehicles_added}")
    print(f"  Duplicates skipped: {skipped}")
    print(f"  Replacements added: {replacements_added}")
    print(f"  Maintenance logs  : {maint_added}")


if __name__ == '__main__':
    main()
