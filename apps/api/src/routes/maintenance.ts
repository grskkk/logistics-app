import { Router } from "express";
import { pool } from "../db";

const router = Router();

function mapLog(row: Record<string, unknown>) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    serviceType: row.service_type,
    notes: row.notes,
    performedAt: row.performed_at,
    workshop: row.workshop,
    kmAtService: row.km_at_service,
    createdAt: row.created_at,
  };
}

router.get("/workshops/all", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT workshop FROM maintenance_logs
     WHERE workshop IS NOT NULL AND workshop <> ''
     ORDER BY workshop`
  );
  res.json(rows.map((r) => r.workshop));
});

router.get("/:vehicleId", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM maintenance_logs WHERE vehicle_id = $1 ORDER BY performed_at DESC",
    [req.params.vehicleId]
  );
  res.json(rows.map(mapLog));
});

router.post("/:vehicleId", async (req, res) => {
  const { serviceType, notes, performedAt, workshop, kmAtService } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO maintenance_logs (vehicle_id, service_type, notes, performed_at, workshop, km_at_service)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.params.vehicleId, serviceType, notes ?? null, performedAt, workshop ?? null, kmAtService ?? null]
  );
  res.status(201).json(mapLog(rows[0]));
});

export default router;
