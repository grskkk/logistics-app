import { Router } from "express";
import { pool } from "../db";

const router = Router();

router.get("/", async (_req, res) => {
  const notes: object[] = [];

  // Vehicles in maintenance with no replacement assigned.
  // Notify once a vehicle has gone 2+ days without a replacement;
  // escalate to urgent (high) once it reaches 5 days.
  const { rows: noRepl } = await pool.query(`
    SELECT v.id, v.license_plate, v.brand, v.model, v.hub,
           COALESCE(v.maintenance_since, v.updated_at::DATE) AS since_date,
           CURRENT_DATE - COALESCE(v.maintenance_since, v.updated_at::DATE) AS days_in
    FROM vehicles v
    WHERE v.status = 'in_maintenance' AND v.archived = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM replacement_vehicles r
        WHERE r.vehicle_id = v.id AND r.end_date IS NULL
      )
      AND CURRENT_DATE - COALESCE(v.maintenance_since, v.updated_at::DATE) >= 2
    ORDER BY days_in DESC
  `);

  for (const r of noRepl) {
    notes.push({
      id: `no-repl-${r.license_plate}`,
      type: "no_replacement",
      severity: r.days_in >= 5 ? "high" : "medium",
      vehicleId: r.id,
      licensePlate: r.license_plate,
      title: `No replacement for ${r.days_in} days — ${r.license_plate}`,
      body: `${[r.brand, r.model].filter(Boolean).join(" ")} has been in maintenance since ${new Date(r.since_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} with no replacement assigned.`,
      hub: r.hub,
      daysIn: r.days_in,
    });
  }

  res.json(notes);
});

export default router;
