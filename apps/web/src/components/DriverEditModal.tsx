import { useEffect, useState } from "react";
import type { Driver, DriverStatus, Vehicle } from "@logistics/shared";
import { api } from "../api/client";

const statusLabel: Record<DriverStatus, string> = {
  available: "Available",
  on_duty: "On Duty",
  offline: "Offline",
};

interface Props {
  driver: Driver;
  onClose: () => void;
  onSaved: (updated: Driver) => void;
}

export default function DriverEditModal({ driver, onClose, onSaved }: Props) {
  const [name, setName] = useState(driver.name);
  const [email, setEmail] = useState(driver.email);
  const [phone, setPhone] = useState(driver.phone);
  const [status, setStatus] = useState<DriverStatus>(driver.status);
  const [vehicleId, setVehicleId] = useState(driver.vehicleId?.toString() ?? "");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Vehicle[]>("/vehicles?archived=false").then(setVehicles).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const updated = await api.put<Driver>(`/drivers/${driver.id}`, {
        name, email, phone, status,
        vehicleId: vehicleId ? parseInt(vehicleId) : null,
      });
      onSaved(updated);
      onClose();
    } catch {
      setError("Failed to save changes.");
    } finally {
      setSubmitting(false);
    }
  };

  const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#57534E" };
  const input: React.CSSProperties = { padding: "9px 12px", borderRadius: 8, border: "1px solid #E7E5E4", fontSize: 14, background: "#fff", fontFamily: "inherit" };

  const availableVehicles = vehicles.filter(
    (v) => v.status !== "on_route" || v.id === driver.vehicleId
  );

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100 }} />
      <div className="modal-window" style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 480, maxHeight: "85vh", borderRadius: 14, background: "#fff", zIndex: 101,
        boxShadow: "0 8px 40px rgba(0,0,0,.15)", display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F5F5F4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1C1917" }}>{driver.name}</div>
            <div style={{ color: "#A8A29E", fontSize: 13 }}>Edit Driver Info</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#A8A29E" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={field}>
            <label style={label}>Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={input} />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ ...field, flex: 1 }}>
              <label style={label}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
            </div>
            <div style={{ ...field, flex: 1 }}>
              <label style={label}>Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={input} />
            </div>
          </div>

          <div style={field}>
            <label style={label}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as DriverStatus)} style={input}>
              {(Object.entries(statusLabel) as [DriverStatus, string][]).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>

          <div style={field}>
            <label style={label}>Assigned Vehicle</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} style={input}>
              <option value="">— Unassigned —</option>
              {availableVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.licensePlate}{v.brand ? ` · ${v.brand}` : ""}{v.model ? ` ${v.model}` : ""} ({v.type})
                </option>
              ))}
            </select>
          </div>

          {error && <span style={{ color: "#DC2626", fontSize: 13 }}>{error}</span>}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #E7E5E4", background: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: submitting ? "#D6D3D1" : "#D97757", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
