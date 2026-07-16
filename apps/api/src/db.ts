import { Pool, types } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Return DATE columns as raw "YYYY-MM-DD" strings instead of JS Date objects.
// pg otherwise parses them at local-timezone midnight, which then shifts by a
// day (or more, depending on DST) once serialized back out as UTC ISO strings.
types.setTypeParser(types.builtins.DATE, (val) => val);

const isLocalDb = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drivers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      vehicle_id INT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id SERIAL PRIMARY KEY,
      license_plate TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      driver_id INT,
      location JSONB,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS brand TEXT;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model TEXT;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_type TEXT;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS capacity_liters NUMERIC;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS lease_start_date DATE;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS lease_company TEXT;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS hub TEXT;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS maintenance_since DATE;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS non_operational_by TEXT;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS non_operational_reason TEXT;

    ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS workshop TEXT;
    ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS km_at_service INTEGER;
    ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS returned_at DATE;

    CREATE TABLE IF NOT EXISTS replacement_vehicles (
      id SERIAL PRIMARY KEY,
      vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      license_plate TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      type TEXT,
      lease_company TEXT,
      start_date DATE NOT NULL,
      end_date DATE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE replacement_vehicles ADD COLUMN IF NOT EXISTS fuel_type TEXT;
    ALTER TABLE replacement_vehicles ADD COLUMN IF NOT EXISTS capacity_liters NUMERIC;

    CREATE TABLE IF NOT EXISTS maintenance_logs (
      id SERIAL PRIMARY KEY,
      vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      service_type TEXT NOT NULL,
      notes TEXT,
      performed_at DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS maintenance_periods (
      id SERIAL PRIMARY KEY,
      vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO maintenance_periods (vehicle_id, start_date)
    SELECT v.id, COALESCE(v.maintenance_since, CURRENT_DATE)
    FROM vehicles v
    WHERE v.status = 'in_maintenance'
      AND NOT EXISTS (
        SELECT 1 FROM maintenance_periods p WHERE p.vehicle_id = v.id AND p.end_date IS NULL
      );

    CREATE TABLE IF NOT EXISTS shipments (
      id SERIAL PRIMARY KEY,
      tracking_number TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      origin JSONB NOT NULL,
      destination JSONB NOT NULL,
      driver_id INT,
      vehicle_id INT,
      estimated_delivery TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}
