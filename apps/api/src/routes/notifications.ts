import { Router } from "express";
import { pool } from "../db";

const router = Router();

router.get("/", async (_req, res) => {
  const notes: object[] = [];

  // Vehicles in maintenance with no replacement for >5 days
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
      AND CURRENT_DATE - COALESCE(v.maintenance_since, v.updated_at::DATE) > 5
    ORDER BY days_in DESC
  `);

  for (const r of noRepl) {
    notes.push({
      id: `no-repl-${r.license_plate}`,
      type: "no_replacement",
      severity: r.days_in >= 14 ? "high" : "medium",
      vehicleId: r.id,
      licensePlate: r.license_plate,
      title: `No replacement for ${r.days_in} days — ${r.license_plate}`,
      body: `${[r.brand, r.model].filter(Boolean).join(" ")} has been in maintenance since ${new Date(r.since_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} with no replacement assigned.`,
      hub: r.hub,
      daysIn: r.days_in,
    });
  }

  // Vehicles with an active replacement for >7 days
  const { rows: longRepair } = await pool.query(`
    SELECT v.id, v.license_plate, v.brand, v.model, v.hub,
           r.license_plate AS repl_plate,
           (CURRENT_DATE - r.start_date::DATE) AS days_in
    FROM vehicles v
    JOIN replacement_vehicles r ON r.vehicle_id = v.id AND r.end_date IS NULL
    WHERE v.status = 'in_maintenance' AND v.archived = FALSE
      AND r.start_date < NOW() - INTERVAL '7 days'
    ORDER BY r.start_date
  `);

  for (const r of longRepair) {
    notes.push({
      id: `long-repair-${r.license_plate}`,
      type: "long_repair",
      severity: r.days_in >= 14 ? "high" : "medium",
      vehicleId: r.id,
      licensePlate: r.license_plate,
      title: `${r.days_in} days in repair — ${r.license_plate}`,
      body: `${[r.brand, r.model].filter(Boolean).join(" ")} has been in maintenance for ${r.days_in} days. Replacement: ${r.repl_plate}.`,
      hub: r.hub,
      daysIn: r.days_in,
    });
  }

  // Non-operational vehicles
  const { rows: nonOp } = await pool.query(`
    SELECT v.id, v.license_plate, v.brand, v.model, v.hub
    FROM vehicles v
    WHERE v.status = 'non_operational' AND v.archived = FALSE
    ORDER BY v.license_plate
  `);

  for (const r of nonOp) {
    notes.push({
      id: `non-op-${r.license_plate}`,
      type: "non_operational",
      severity: "high",
      vehicleId: r.id,
      licensePlate: r.license_plate,
      title: `Non-operational — ${r.license_plate}`,
      body: `${[r.brand, r.model].filter(Boolean).join(" ")} is marked as non-operational.`,
      hub: r.hub,
    });
  }

  res.json(notes);
});

export default router;
