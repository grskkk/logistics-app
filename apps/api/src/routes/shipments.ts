import { Router } from "express";
import { pool } from "../db";

const router = Router();

function mapShipment(row: Record<string, unknown>) {
  return {
    id: row.id,
    trackingNumber: row.tracking_number,
    status: row.status,
    origin: row.origin,
    destination: row.destination,
    driverId: row.driver_id,
    vehicleId: row.vehicle_id,
    estimatedDelivery: row.estimated_delivery,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/", async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM shipments ORDER BY created_at DESC");
  res.json(rows.map(mapShipment));
});

router.get("/:id", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM shipments WHERE id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Shipment not found" });
  res.json(mapShipment(rows[0]));
});

router.post("/", async (req, res) => {
  const { origin, destination, driverId, vehicleId, estimatedDelivery } = req.body;
  const trackingNumber = `TRK-${Date.now()}`;
  const { rows } = await pool.query(
    `INSERT INTO shipments (tracking_number, origin, destination, driver_id, vehicle_id, estimated_delivery)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [trackingNumber, origin, destination, driverId ?? null, vehicleId ?? null, estimatedDelivery ?? null]
  );
  res.status(201).json(mapShipment(rows[0]));
});

router.put("/:id", async (req, res) => {
  const { status, driverId, vehicleId } = req.body;
  const { rows } = await pool.query(
    `UPDATE shipments SET status = COALESCE($1, status),
     driver_id = COALESCE($2, driver_id),
     vehicle_id = COALESCE($3, vehicle_id),
     updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [status ?? null, driverId ?? null, vehicleId ?? null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Shipment not found" });
  res.json(mapShipment(rows[0]));
});

export default router;
