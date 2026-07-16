import { Router } from "express";
import { pool } from "../db";

const router = Router();

function mapVehicle(row: Record<string, unknown>) {
  return {
    id: row.id,
    licensePlate: row.license_plate,
    type: row.type,
    status: row.status,
    brand: row.brand,
    model: row.model,
    fuelType: row.fuel_type,
    capacityLiters: row.capacity_liters,
    leaseStartDate: row.lease_start_date,
    leaseCompany: row.lease_company,
    hub: row.hub,
    archived: row.archived,
    hasActiveReplacement: row.has_active_replacement ?? false,
    driverId: row.driver_id,
    location: row.location,
    nonOperationalBy: row.non_operational_by,
    nonOperationalReason: row.non_operational_reason,
    updatedAt: row.updated_at,
  };
}

router.get("/", async (req, res) => {
  const showArchived = req.query.archived === "true";
  const { rows } = await pool.query(
    `SELECT v.*,
       EXISTS(
         SELECT 1 FROM replacement_vehicles r
         WHERE r.vehicle_id = v.id AND r.end_date IS NULL
       ) AS has_active_replacement
     FROM vehicles v
     WHERE v.archived = $1
     ORDER BY v.id`,
    [showArchived]
  );
  res.json(rows.map(mapVehicle));
});

router.get("/:id", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT v.*,
       EXISTS(
         SELECT 1 FROM replacement_vehicles r
         WHERE r.vehicle_id = v.id AND r.end_date IS NULL
       ) AS has_active_replacement
     FROM vehicles v
     WHERE v.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Vehicle not found" });
  res.json(mapVehicle(rows[0]));
});

router.post("/", async (req, res) => {
  const { licensePlate, type, status, brand, model, fuelType, capacityLiters, leaseStartDate, leaseCompany, hub, nonOperationalBy, nonOperationalReason } = req.body;
  const initialStatus = status ?? "operational";
  const { rows } = await pool.query(
    `INSERT INTO vehicles (license_plate, type, status, brand, model, fuel_type, capacity_liters, lease_start_date, lease_company, hub, maintenance_since, non_operational_by, non_operational_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
    [
      licensePlate,
      type,
      initialStatus,
      brand ?? null,
      model ?? null,
      fuelType ?? null,
      capacityLiters ?? null,
      leaseStartDate ?? null,
      leaseCompany ?? null,
      hub ?? null,
      initialStatus === "in_maintenance" ? new Date() : null,
      initialStatus === "non_operational" ? nonOperationalBy ?? null : null,
      initialStatus === "non_operational" ? nonOperationalReason ?? null : null,
    ]
  );
  if (initialStatus === "in_maintenance") {
    await pool.query(
      "INSERT INTO maintenance_periods (vehicle_id, start_date) VALUES ($1, $2)",
      [rows[0].id, rows[0].maintenance_since]
    );
  }
  res.status(201).json(mapVehicle(rows[0]));
});

router.put("/:id", async (req, res) => {
  const { licensePlate, type, status, brand, model, driverId, location, fuelType, capacityLiters, leaseStartDate, leaseCompany, hub, archived, nonOperationalBy, nonOperationalReason } = req.body;

  const { rows: existingRows } = await pool.query("SELECT status FROM vehicles WHERE id = $1", [req.params.id]);
  if (!existingRows[0]) return res.status(404).json({ error: "Vehicle not found" });
  const prevStatus = existingRows[0].status;
  const newStatus = status ?? prevStatus;

  const { rows } = await pool.query(
    `UPDATE vehicles SET
     license_plate = COALESCE($1, license_plate),
     type = COALESCE($2, type),
     status = COALESCE($3, status),
     brand = COALESCE($4, brand),
     model = COALESCE($5, model),
     driver_id = COALESCE($6, driver_id),
     location = COALESCE($7, location),
     fuel_type = COALESCE($8, fuel_type),
     capacity_liters = COALESCE($9, capacity_liters),
     lease_start_date = COALESCE($10, lease_start_date),
     lease_company = COALESCE($11, lease_company),
     hub = COALESCE($12, hub),
     archived = COALESCE($13, archived),
     maintenance_since = CASE
       WHEN COALESCE($3, status) = 'in_maintenance' AND status IS DISTINCT FROM 'in_maintenance' THEN CURRENT_DATE
       WHEN COALESCE($3, status) IS DISTINCT FROM 'in_maintenance' THEN NULL
       ELSE maintenance_since
     END,
     non_operational_by = CASE
       WHEN COALESCE($3, status) = 'non_operational' THEN COALESCE($15, non_operational_by)
       ELSE NULL
     END,
     non_operational_reason = CASE
       WHEN COALESCE($3, status) = 'non_operational' THEN COALESCE($16, non_operational_reason)
       ELSE NULL
     END,
     updated_at = NOW()
     WHERE id = $14 RETURNING *`,
    [
      licensePlate ?? null,
      type ?? null,
      status ?? null,
      brand ?? null,
      model ?? null,
      driverId ?? null,
      location ? JSON.stringify(location) : null,
      fuelType ?? null,
      capacityLiters ?? null,
      leaseStartDate ?? null,
      leaseCompany ?? null,
      hub ?? null,
      archived ?? null,
      req.params.id,
      nonOperationalBy ?? null,
      nonOperationalReason ?? null,
    ]
  );
  if (!rows[0]) return res.status(404).json({ error: "Vehicle not found" });

  if (newStatus === "in_maintenance" && prevStatus !== "in_maintenance") {
    await pool.query(
      "INSERT INTO maintenance_periods (vehicle_id, start_date) VALUES ($1, COALESCE($2, CURRENT_DATE))",
      [req.params.id, rows[0].maintenance_since]
    );
  } else if (newStatus !== "in_maintenance" && prevStatus === "in_maintenance") {
    await pool.query(
      "UPDATE maintenance_periods SET end_date = CURRENT_DATE WHERE vehicle_id = $1 AND end_date IS NULL",
      [req.params.id]
    );
  }

  res.json(mapVehicle(rows[0]));
});

export default router;
