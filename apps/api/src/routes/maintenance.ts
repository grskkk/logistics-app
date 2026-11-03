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
    returnedAt: row.returned_at,
    workshop: row.workshop,
    kmAtService: row.km_at_service,
    createdAt: row.created_at,
  };
}

function mapPeriod(row: Record<string, unknown>) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    startDate: row.start_date,
    endDate: row.end_date,
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

router.get("/:vehicleId/periods", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM maintenance_periods WHERE vehicle_id = $1 ORDER BY start_date DESC",
    [req.params.vehicleId]
  );
  res.json(rows.map(mapPeriod));
});

// Delete a past maintenance period (e.g. one logged by mistake). Only closed
// periods can be removed; the still-open/ongoing one is left alone, since that
// is what represents the vehicle's current in_maintenance state — use the
// "Returned from workshop" action to close it instead. Logs are linked to a
// period only by their date falling within it, so they are left untouched and
// simply fall under "Other Records" afterwards.
router.delete("/period/:periodId", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT end_date FROM maintenance_periods WHERE id = $1",
    [req.params.periodId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Maintenance period not found" });
  if (rows[0].end_date === null) {
    return res.status(400).json({ error: "Cannot delete the ongoing maintenance period" });
  }

  await pool.query("DELETE FROM maintenance_periods WHERE id = $1", [req.params.periodId]);
  res.status(204).end();
});

// Delete a single maintenance record (a log entered by mistake). The parent
// period, if any, is left intact.
router.delete("/log/:logId", async (req, res) => {
  const { rows } = await pool.query(
    "DELETE FROM maintenance_logs WHERE id = $1 RETURNING id",
    [req.params.logId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Maintenance record not found" });
  res.status(204).end();
});

router.post("/:vehicleId", async (req, res) => {
  const { serviceType, notes, performedAt, returnedAt, workshop, kmAtService } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO maintenance_logs (vehicle_id, service_type, notes, performed_at, returned_at, workshop, km_at_service)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.params.vehicleId, serviceType, notes ?? null, performedAt, returnedAt ?? null, workshop ?? null, kmAtService ?? null]
  );

  // Logging an open repair (no return date) means the vehicle is going into
  // maintenance now — flip its status and open a maintenance period
  // automatically, so it no longer has to be done by hand. A back-dated record
  // that already has a return date is history and leaves the status untouched.
  if (!returnedAt) {
    const { rows: flipped } = await pool.query(
      `UPDATE vehicles
         SET status = 'in_maintenance',
             maintenance_since = COALESCE($2::date, CURRENT_DATE),
             updated_at = NOW()
       WHERE id = $1 AND status <> 'in_maintenance'
       RETURNING id`,
      [req.params.vehicleId, performedAt ?? null]
    );
    if (flipped[0]) {
      await pool.query(
        `INSERT INTO maintenance_periods (vehicle_id, start_date)
         SELECT $1, COALESCE($2::date, CURRENT_DATE)
         WHERE NOT EXISTS (
           SELECT 1 FROM maintenance_periods WHERE vehicle_id = $1 AND end_date IS NULL
         )`,
        [req.params.vehicleId, performedAt ?? null]
      );
    }
  }

  res.status(201).json(mapLog(rows[0]));
});

export default router;
