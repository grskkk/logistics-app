import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { initDb } from "./db";
import { authEnabled, isAuthenticated, login, logout, requireAuth } from "./auth";
import shipmentsRouter from "./routes/shipments";
import vehiclesRouter from "./routes/vehicles";
import driversRouter from "./routes/drivers";
import maintenanceRouter from "./routes/maintenance";
import replacementsRouter from "./routes/replacements";
import notificationsRouter from "./routes/notifications";
import appointmentsRouter from "./routes/appointments";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3001;

// Behind Render's proxy; needed for req.secure to reflect the real HTTPS scheme.
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// --- Auth (shared-password login) ---
// These endpoints stay public; everything under /api below requireAuth is gated.
app.post("/api/login", (req, res) => {
  if (login(req, res, req.body?.password)) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: "Incorrect password" });
  }
});
app.post("/api/logout", (_req, res) => {
  logout(res);
  res.json({ ok: true });
});
app.get("/api/me", (req, res) => {
  res.json({ authenticated: !authEnabled || isAuthenticated(req), authEnabled });
});

app.use("/api", requireAuth);

app.use("/api/shipments", shipmentsRouter);
app.use("/api/vehicles", vehiclesRouter);
app.use("/api/drivers", driversRouter);
app.use("/api/maintenance", maintenanceRouter);
app.use("/api/replacements", replacementsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/appointments", appointmentsRouter);

// Serve web frontend in production
const publicDir = path.join(__dirname, "../public");
app.use(express.static(publicDir));
app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
      if (!authEnabled) {
        console.warn(
          "[auth] AUTH_PASSWORD is not set — the app is OPEN to anyone with the URL. " +
            "Set AUTH_PASSWORD to require login."
        );
      }
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
