import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDb } from "./db";
import shipmentsRouter from "./routes/shipments";
import vehiclesRouter from "./routes/vehicles";
import driversRouter from "./routes/drivers";
import maintenanceRouter from "./routes/maintenance";
import replacementsRouter from "./routes/replacements";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.use("/api/shipments", shipmentsRouter);
app.use("/api/vehicles", vehiclesRouter);
app.use("/api/drivers", driversRouter);
app.use("/api/maintenance", maintenanceRouter);
app.use("/api/replacements", replacementsRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
