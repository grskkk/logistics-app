import { useState } from "react";
import type { DriverStatus } from "@logistics/shared";
import { api } from "../api/client";

const statusLabel: Record<DriverStatus, string> = {
  available: "Available",
  on_duty: "On Duty",
  offline: "Offline",
};

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

export default function AddDriverModal({ onClose, onAdded }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<DriverStatus>("available");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post("/drivers", { name: name.trim(), email: email.trim(), phone: phone.trim(), status });
      onAdded();
      onClose();
    } catch {
      setError("Failed to add driver. Email may already exist.");
    } finally {
      setSubmitting(false);
    }
  };

  const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#57534E" };
  const input: React.CSSProperties = { padding: "9px 12px", borderRadius: 8, border: "1px solid #E7E5E4", fontSize: 14, background: "#fff", fontFamily: "inherit" };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100 }} />
      <div className="modal-window" style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 480, borderRadius: 14, background: "#fff", zIndex: 101,
        boxShadow: "0 8px 40px rgba(0,0,0,.15)", display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F5F5F4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#1C1917" }}>Add Driver</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#A8A29E" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={field}>
            <label style={label}>Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Smith" autoFocus style={input} />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ ...field, flex: 1 }}>
              <label style={label}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" style={input} />
            </div>
            <div style={{ ...field, flex: 1 }}>
              <label style={label}>Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0100" style={input} />
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

          {error && <span style={{ color: "#DC2626", fontSize: 13 }}>{error}</span>}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #E7E5E4", background: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting || !name.trim() || !email.trim() || !phone.trim()} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: submitting || !name.trim() || !email.trim() || !phone.trim() ? "#D6D3D1" : "#D97757", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              {submitting ? "Adding..." : "Add Driver"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
