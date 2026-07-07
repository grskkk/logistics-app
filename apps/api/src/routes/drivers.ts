import { Router } from "express";
import { pool } from "../db";

const router = Router();

function mapDriver(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    vehicleId: row.vehicle_id,
    createdAt: row.created_at,
  };
}

router.get("/", async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM drivers ORDER BY id");
  res.json(rows.map(mapDriver));
});

router.post("/", async (req, res) => {
  const { name, email, phone, status } = req.body;
  const { rows } = await pool.query(
    "INSERT INTO drivers (name, email, phone, status) VALUES ($1, $2, $3, $4) RETURNING *",
    [name, email, phone, status ?? "available"]
  );
  res.status(201).json(mapDriver(rows[0]));
});

router.put("/:id", async (req, res) => {
  const { name, email, phone, status, vehicleId } = req.body;
  const driverId = parseInt(req.params.id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get the driver's current vehicle assignment
    const { rows: current } = await client.query(
      "SELECT vehicle_id FROM drivers WHERE id = $1", [driverId]
    );
    if (!current[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Driver not found" }); }

    const prevVehicleId = current[0].vehicle_id;
    const newVehicleId = vehicleId !== undefined ? (vehicleId || null) : prevVehicleId;

    // Clear driver_id on the previously assigned vehicle
    if (prevVehicleId && prevVehicleId !== newVehicleId) {
      await client.query("UPDATE vehicles SET driver_id = NULL WHERE id = $1", [prevVehicleId]);
    }

    // Set driver_id on the newly assigned vehicle
    if (newVehicleId && newVehicleId !== prevVehicleId) {
      await client.query("UPDATE vehicles SET driver_id = $1 WHERE id = $2", [driverId, newVehicleId]);
    }

    // Update the driver
    const { rows } = await client.query(
      `UPDATE drivers SET
       name = COALESCE($1, name),
       email = COALESCE($2, email),
       phone = COALESCE($3, phone),
       status = COALESCE($4, status),
       vehicle_id = $5
       WHERE id = $6 RETURNING *`,
      [name ?? null, email ?? null, phone ?? null, status ?? null, newVehicleId, driverId]
    );

    await client.query("COMMIT");
    res.json(mapDriver(rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

export default router;
