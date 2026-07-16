import { Router } from "express";
import { pool } from "../db";

const router = Router();

function mapReplacement(row: Record<string, unknown>) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    licensePlate: row.license_plate,
    brand: row.brand,
    model: row.model,
    type: row.type,
    fuelType: row.fuel_type,
    capacityLiters: row.capacity_liters,
    leaseCompany: row.lease_company,
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

// Get active replacement for a vehicle
router.get("/:vehicleId", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM replacement_vehicles WHERE vehicle_id = $1 AND end_date IS NULL ORDER BY created_at DESC LIMIT 1",
    [req.params.vehicleId]
  );
  res.json(rows[0] ? mapReplacement(rows[0]) : null);
});

// Get full replacement history for a vehicle
router.get("/:vehicleId/history", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM replacement_vehicles WHERE vehicle_id = $1 ORDER BY start_date DESC",
    [req.params.vehicleId]
  );
  res.json(rows.map(mapReplacement));
});

// Assign a new replacement vehicle
router.post("/:vehicleId", async (req, res) => {
  const { licensePlate, brand, model, type, fuelType, capacityLiters, leaseCompany, startDate, notes } = req.body;

  // Close any existing active replacement first
  await pool.query(
    "UPDATE replacement_vehicles SET end_date = NOW() WHERE vehicle_id = $1 AND end_date IS NULL",
    [req.params.vehicleId]
  );

  const { rows } = await pool.query(
    `INSERT INTO replacement_vehicles (vehicle_id, license_plate, brand, model, type, fuel_type, capacity_liters, lease_company, start_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [req.params.vehicleId, licensePlate, brand ?? null, model ?? null, type ?? null, fuelType ?? null, capacityLiters ?? null, leaseCompany ?? null, startDate, notes ?? null]
  );
  res.status(201).json(mapReplacement(rows[0]));
});

// Return the replacement vehicle (set end_date)
router.put("/:id/return", async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE replacement_vehicles SET end_date = NOW() WHERE id = $1 RETURNING *",
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Replacement not found" });
  res.json(mapReplacement(rows[0]));
});

export default router;
