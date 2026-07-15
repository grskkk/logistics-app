import { useState } from "react";
import type { Vehicle } from "@logistics/shared";
import { api } from "../api/client";

interface Props {
  vehicle: Vehicle;
  onClose: () => void;
  onConfirmed: () => void;
}

export default function MarkNonOperationalModal({ vehicle, onClose, onConfirmed }: Props) {
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !reason.trim()) return;
    setSubmitting(true);
    try {
      await api.put(`/vehicles/${vehicle.id}`, {
        status: "non_operational",
        nonOperationalBy: name.trim(),
        nonOperationalReason: reason.trim(),
      });
      onConfirmed();
    } finally {
      setSubmitting(false);
    }
  };

  const input: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid #E7E5E4", fontSize: 14, background: "#fff", fontFamily: "inherit" };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100 }} />
      <div className="modal-window" style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 400, borderRadius: 14, background: "#fff", zIndex: 101,
        boxShadow: "0 8px 40px rgba(0,0,0,.15)", display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F5F5F4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1C1917" }}>{vehicle.licensePlate}</div>
            <div style={{ color: "#A8A29E", fontSize: 13 }}>Mark Non-Operational</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#A8A29E" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#57534E" }}>Your name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Giorgos"
              style={input}
            />
            <span style={{ fontSize: 11, color: "#94a3b8" }}>So teammates know who flagged this vehicle.</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#57534E" }}>Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Won't start, accident damage, flat tire..."
              rows={3}
              style={{ ...input, resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #E7E5E4", background: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", color: "#57534E" }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting || !name.trim() || !reason.trim()} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: submitting || !name.trim() || !reason.trim() ? "#D6D3D1" : "#DC2626", color: "#fff", fontWeight: 700, fontSize: 14, cursor: submitting || !name.trim() || !reason.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {submitting ? "Saving..." : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
