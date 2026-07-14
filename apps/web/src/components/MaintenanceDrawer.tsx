import { useEffect, useState } from "react";
import type { MaintenanceLog, Vehicle } from "@logistics/shared";
import { api } from "../api/client";

const SERVICE_TYPES = [
  "Oil Change",
  "Brake Pads",
  "Tire Rotation",
  "Tire Replacement",
  "Battery Replacement",
  "Air Filter",
  "Transmission Service",
  "Coolant Flush",
  "Spark Plugs",
  "General Inspection",
  "Other",
];

interface Props {
  vehicle: Vehicle;
  onClose: () => void;
}

export default function MaintenanceDrawer({ vehicle, onClose }: Props) {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [workshops, setWorkshops] = useState<string[]>([]);
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  const [notes, setNotes] = useState("");
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().slice(0, 10));
  const [workshop, setWorkshop] = useState("");
  const [kmAtService, setKmAtService] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () =>
    api.get<MaintenanceLog[]>(`/maintenance/${vehicle.id}`).then(setLogs).catch(console.error);

  useEffect(() => { load(); }, [vehicle.id]);
  useEffect(() => {
    api.get<string[]>("/maintenance/workshops/all").then(setWorkshops).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/maintenance/${vehicle.id}`, {
        serviceType, notes: notes || null, performedAt,
        workshop: workshop || null,
        kmAtService: kmAtService ? parseInt(kmAtService) : null,
      });
      setNotes(""); setServiceType(SERVICE_TYPES[0]);
      setPerformedAt(new Date().toISOString().slice(0, 10));
      setWorkshop(""); setKmAtService("");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} />
      <div className="modal-window" style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 520, maxHeight: "85vh", borderRadius: 12,
        background: "#fff", zIndex: 101, boxShadow: "0 8px 40px rgba(0,0,0,.2)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{vehicle.licensePlate}</div>
            <div style={{ color: "#64748b", fontSize: 13, textTransform: "capitalize" }}>{vehicle.type} · Maintenance History</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, borderBottom: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Log New Service</div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Service Type</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }}
              >
                {SERVICE_TYPES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Date</label>
              <input
                type="date"
                value={performedAt}
                onChange={(e) => setPerformedAt(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Workshop (optional)</label>
              <select
                value={workshop}
                onChange={(e) => setWorkshop(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }}
              >
                <option value="">Select workshop...</option>
                {workshops.map((w) => <option key={w}>{w}</option>)}
              </select>
            </div>
            <div style={{ width: 110, display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>KM at service</label>
              <input type="number" value={kmAtService} onChange={(e) => setKmAtService(e.target.value)} placeholder="e.g. 45000" style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "inherit" }} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Replaced front brake pads, rear at 60%..."
              rows={2}
              style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, resize: "vertical", fontFamily: "inherit" }}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{ padding: "8px 0", borderRadius: 6, background: submitting ? "#D6D3D1" : "#D97757", color: "#fff", border: "none", fontWeight: 600, fontSize: 14, cursor: submitting ? "not-allowed" : "pointer" }}
          >
            {submitting ? "Saving..." : "Save Record"}
          </button>
        </form>

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
            History {logs.length > 0 && <span style={{ color: "#94a3b8", fontWeight: 400 }}>({logs.length} records)</span>}
          </div>
          {logs.length === 0 && (
            <div style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", marginTop: 32 }}>No maintenance records yet.</div>
          )}
          {logs.map((log) => (
            <div key={log.id} style={{ borderLeft: "3px solid #D97757", paddingLeft: 14, marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "#1C1917" }}>{log.serviceType}</span>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  {new Date(log.performedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              {(log.workshop || log.kmAtService) && (
                <div style={{ fontSize: 12, color: "#78716C", marginTop: 3, display: "flex", gap: 12 }}>
                  {log.workshop && <span>📍 {log.workshop}</span>}
                  {log.kmAtService && <span>⟳ {log.kmAtService.toLocaleString()} km</span>}
                </div>
              )}
              {log.notes && <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>{log.notes}</div>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
