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
    archived: row.archived,
    driverId: row.driver_id,
    location: row.location,
    updatedAt: row.updated_at,
  };
}

router.get("/", async (req, res) => {
  const showArchived = req.query.archived === "true";
  const { rows } = await pool.query(
    "SELECT * FROM vehicles WHERE archived = $1 ORDER BY id",
    [showArchived]
  );
  res.json(rows.map(mapVehicle));
});

router.post("/", async (req, res) => {
  const { licensePlate, type, status, brand, model, fuelType, capacityLiters, leaseStartDate } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO vehicles (license_plate, type, status, brand, model, fuel_type, capacity_liters, lease_start_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      licensePlate,
      type,
      status ?? "operational",
      brand ?? null,
      model ?? null,
      fuelType ?? null,
      capacityLiters ?? null,
      leaseStartDate ?? null,
    ]
  );
  res.status(201).json(mapVehicle(rows[0]));
});

router.put("/:id", async (req, res) => {
  const { licensePlate, type, status, brand, model, driverId, location, fuelType, capacityLiters, leaseStartDate, archived } = req.body;
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
     archived = COALESCE($11, archived),
     updated_at = NOW()
     WHERE id = $12 RETURNING *`,
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
      archived ?? null,
      req.params.id,
    ]
  );
  if (!rows[0]) return res.status(404).json({ error: "Vehicle not found" });
  res.json(mapVehicle(rows[0]));
});

export default router;
