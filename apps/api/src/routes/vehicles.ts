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

router.post("/", async (req, res) => {
  const { licensePlate, type, status, brand, model, fuelType, capacityLiters, leaseStartDate, leaseCompany, hub } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO vehicles (license_plate, type, status, brand, model, fuel_type, capacity_liters, lease_start_date, lease_company, hub)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      licensePlate,
      type,
      status ?? "operational",
      brand ?? null,
      model ?? null,
      fuelType ?? null,
      capacityLiters ?? null,
      leaseStartDate ?? null,
      leaseCompany ?? null,
      hub ?? null,
    ]
  );
  res.status(201).json(mapVehicle(rows[0]));
});

router.put("/:id", async (req, res) => {
  const { licensePlate, type, status, brand, model, driverId, location, fuelType, capacityLiters, leaseStartDate, leaseCompany, hub, archived } = req.body;
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
    ]
  );
  if (!rows[0]) return res.status(404).json({ error: "Vehicle not found" });
  res.json(mapVehicle(rows[0]));
});

export default router;
