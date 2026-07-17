import { Router } from "express";
import { pool } from "../db";

const router = Router();

function mapAppointment(row: Record<string, unknown>) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    licensePlate: row.license_plate,
    scheduledAt: row.scheduled_at,
    workshop: row.workshop,
    reason: row.reason,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
  };
}

// Re-read a single appointment joined with its vehicle plate.
async function fetchOne(id: number) {
  const { rows } = await pool.query(
    `SELECT a.*, v.license_plate
     FROM appointments a JOIN vehicles v ON v.id = a.vehicle_id
     WHERE a.id = $1`,
    [id]
  );
  return rows[0] ? mapAppointment(rows[0]) : null;
}

router.get("/", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT a.*, v.license_plate
     FROM appointments a JOIN vehicles v ON v.id = a.vehicle_id
     ORDER BY a.scheduled_at ASC`
  );
  res.json(rows.map(mapAppointment));
});

router.post("/", async (req, res) => {
  const { vehicleId, scheduledAt, workshop, reason, notes, status } = req.body;
  if (!vehicleId || !scheduledAt || !reason) {
    return res.status(400).json({ error: "vehicleId, scheduledAt and reason are required" });
  }
  const { rows } = await pool.query(
    `INSERT INTO appointments (vehicle_id, scheduled_at, workshop, reason, notes, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [vehicleId, scheduledAt, workshop ?? null, reason, notes ?? null, status ?? "scheduled"]
  );
  res.status(201).json(await fetchOne(rows[0].id));
});

// Only updates the fields actually present in the body, so a partial update
// (e.g. just { status }) leaves the other columns untouched, while an edit that
// sends workshop/notes as null can still clear them.
const UPDATABLE: Record<string, string> = {
  vehicleId: "vehicle_id",
  scheduledAt: "scheduled_at",
  workshop: "workshop",
  reason: "reason",
  notes: "notes",
  status: "status",
};

router.put("/:id", async (req, res) => {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(UPDATABLE)) {
    if (key in req.body) {
      sets.push(`${column} = $${values.length + 1}`);
      values.push(req.body[key]);
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: "No fields to update" });
  values.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE appointments SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING id`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: "Appointment not found" });
  res.json(await fetchOne(rows[0].id));
});

router.delete("/:id", async (req, res) => {
  await pool.query("DELETE FROM appointments WHERE id = $1", [req.params.id]);
  res.status(204).end();
});

export default router;
