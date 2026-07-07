import { useState } from "react";
import type { VehicleStatus } from "@logistics/shared";
import { api } from "../api/client";

const statusLabel: Record<VehicleStatus, string> = {
  operational: "Operational",
  on_route: "On Route",
  in_maintenance: "In Maintenance",
  non_operational: "Non Operational",
};

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

export default function AddVehicleModal({ onClose, onAdded }: Props) {
  const [licensePlate, setLicensePlate] = useState("");
  const [type, setType] = useState<"van" | "truck" | "bike" | "car">("van");
  const [status, setStatus] = useState<VehicleStatus>("operational");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [capacityLiters, setCapacityLiters] = useState("");
  const [leaseStartDate, setLeaseStartDate] = useState("");
  const [leaseCompany, setLeaseCompany] = useState("");
  const [hub, setHub] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licensePlate.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post("/vehicles", {
        licensePlate: licensePlate.trim(),
        type,
        status,
        brand: brand || null,
        model: model || null,
        fuelType: fuelType || null,
        capacityLiters: capacityLiters ? parseFloat(capacityLiters) : null,
        leaseStartDate: leaseStartDate || null,
        leaseCompany: leaseCompany || null,
        hub: hub || null,
      });
      onAdded();
      onClose();
    } catch {
      setError("Failed to add vehicle. Plate may already exist.");
    } finally {
      setSubmitting(false);
    }
  };

  const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#475569" };
  const input: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14, background: "#fff" };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100 }} />
      <div className="modal-window" style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 520, maxHeight: "85vh", borderRadius: 12,
        background: "#fff", zIndex: 101, boxShadow: "0 8px 40px rgba(0,0,0,.2)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Add Vehicle</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>

          <div style={field}>
            <label style={label}>License Plate</label>
            <input
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value.toUpperCase().replace(/-/g, ""))}
              placeholder="e.g. ABC1234"
              autoFocus
              style={input}
            />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ ...field, flex: 1 }}>
              <label style={label}>Brand</label>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Mercedes"
                style={input}
              />
            </div>
            <div style={{ ...field, flex: 1 }}>
              <label style={label}>Model</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Sprinter"
                style={input}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ ...field, flex: 1 }}>
              <label style={label}>Vehicle Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as typeof type)} style={input}>
                <option value="van">Van</option>
                <option value="truck">Truck</option>
                <option value="bike">Bike</option>
                <option value="car">Car</option>
              </select>
            </div>
            <div style={{ ...field, flex: 1 }}>
              <label style={label}>Operational Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as VehicleStatus)} style={input}>
                {(Object.entries(statusLabel) as [VehicleStatus, string][]).map(([val, lbl]) => (
                  <option key={val} value={val}>{lbl}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={field}>
            <label style={label}>Fuel Type</label>
            <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} style={input}>
              <option value="">— Select —</option>
              <option value="gas">Gas</option>
              <option value="diesel">Diesel</option>
              <option value="electric">Electric</option>
            </select>
          </div>

          <div style={field}>
            <label style={label}>Capacity (liters)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={capacityLiters}
              onChange={(e) => setCapacityLiters(e.target.value)}
              placeholder="e.g. 1200"
              style={input}
            />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ ...field, flex: 1 }}>
              <label style={label}>Leasing Company</label>
              <select value={leaseCompany} onChange={(e) => setLeaseCompany(e.target.value)} style={input}>
                <option value="">— None —</option>
                <option>Avis</option>
                <option>Ayvens</option>
                <option>LeasePlan</option>
              </select>
            </div>
            <div style={{ ...field, flex: 1 }}>
              <label style={label}>Hub</label>
              <select value={hub} onChange={(e) => setHub(e.target.value)} style={input}>
                <option value="">— None —</option>
                <option>Athens</option>
                <option>Alimos</option>
                <option>Menidi</option>
                <option>Mandra</option>
                <option>Paiania</option>
              </select>
            </div>
          </div>

          <div style={field}>
            <label style={label}>Lease Start Date</label>
            <input type="date" value={leaseStartDate} onChange={(e) => setLeaseStartDate(e.target.value)} style={input} />
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Leave blank if vehicle is owned</span>
          </div>

          {error && <span style={{ color: "#ef4444", fontSize: 13 }}>{error}</span>}

          <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting || !licensePlate.trim()} style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: "none", background: submitting || !licensePlate.trim() ? "#D6D3D1" : "#D97757", color: "#fff", fontWeight: 600, fontSize: 14, cursor: submitting || !licensePlate.trim() ? "not-allowed" : "pointer" }}>
              {submitting ? "Adding..." : "Add Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
