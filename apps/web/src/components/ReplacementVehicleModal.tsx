import { useEffect, useState } from "react";
import type { ReplacementVehicle, Vehicle } from "@logistics/shared";
import { api } from "../api/client";

interface Props {
  vehicle: Vehicle;
  onClose: () => void;
}

export default function ReplacementVehicleModal({ vehicle, onClose }: Props) {
  const [active, setActive] = useState<ReplacementVehicle | null>(null);
  const [history, setHistory] = useState<ReplacementVehicle[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [licensePlate, setLicensePlate] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [type, setType] = useState("van");
  const [leaseCompany, setLeaseCompany] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const load = async () => {
    const [activeRes, historyRes] = await Promise.all([
      api.get<ReplacementVehicle | null>(`/replacements/${vehicle.id}`),
      api.get<ReplacementVehicle[]>(`/replacements/${vehicle.id}/history`),
    ]);
    setActive(activeRes);
    setHistory(historyRes);
    setShowForm(!activeRes);
  };

  const prefillFromPast = (r: ReplacementVehicle) => {
    setLicensePlate(r.licensePlate);
    setBrand(r.brand ?? "");
    setModel(r.model ?? "");
    setType(r.type ?? "van");
    setLeaseCompany(r.leaseCompany ?? "");
    setStartDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setShowForm(true);
    setTimeout(() => document.getElementById("replacement-form")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  useEffect(() => { load(); }, [vehicle.id]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/replacements/${vehicle.id}`, {
        licensePlate: licensePlate.toUpperCase().replace(/-/g, ""),
        brand: brand || null,
        model: model || null,
        type,
        leaseCompany: leaseCompany || null,
        startDate,
        notes: notes || null,
      });
      setLicensePlate(""); setBrand(""); setModel(""); setLeaseCompany(""); setNotes("");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async () => {
    if (!active) return;
    await api.put(`/replacements/${active.id}/return`, {});
    await load();
  };

  const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#57534E" };
  const input: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid #E7E5E4", fontSize: 14, background: "#fff", fontFamily: "inherit" };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100 }} />
      <div className="modal-window" style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 520, maxHeight: "88vh", borderRadius: 14, background: "#fff", zIndex: 101,
        boxShadow: "0 8px 40px rgba(0,0,0,.15)", display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F5F5F4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1C1917" }}>{vehicle.licensePlate}</div>
            <div style={{ color: "#A8A29E", fontSize: 13 }}>Replacement Vehicle</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#A8A29E" }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Active replacement */}
          {active && (
            <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#C2410C", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                Active Replacement
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: 16, color: "#1C1917" }}>{active.licensePlate}</span>
                  {(active.brand || active.model) && <span style={{ color: "#78716C", fontSize: 13 }}>{active.brand} {active.model}</span>}
                  {active.leaseCompany && <span style={{ color: "#78716C", fontSize: 13 }}>From: {active.leaseCompany}</span>}
                  <span style={{ color: "#A8A29E", fontSize: 12 }}>
                    Since {new Date(active.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                  </span>
                  {active.notes && <span style={{ color: "#78716C", fontSize: 13, marginTop: 4 }}>{active.notes}</span>}
                </div>
                <button
                  onClick={handleReturn}
                  style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #FED7AA", background: "#fff", color: "#C2410C", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                >
                  Mark Returned
                </button>
              </div>
              <button
                onClick={() => setShowForm((v) => !v)}
                style={{ marginTop: 12, fontSize: 13, color: "#D97757", background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0, fontFamily: "inherit" }}
              >
                {showForm ? "▲ Hide form" : "▼ Assign different replacement"}
              </button>
            </div>
          )}

          {/* Assign form */}
          {showForm && (
            <form id="replacement-form" onSubmit={handleAssign} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1C1917" }}>
                {active ? "Assign Different Replacement" : "Assign Replacement Vehicle"}
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ ...field, flex: 1 }}>
                  <label style={label}>License Plate *</label>
                  <input value={licensePlate} onChange={(e) => setLicensePlate(e.target.value.toUpperCase().replace(/-/g, ""))} placeholder="e.g. ABC1234" required style={input} />
                </div>
                <div style={{ ...field, flex: 1 }}>
                  <label style={label}>Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} style={input}>
                    <option value="van">Van</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ ...field, flex: 1 }}>
                  <label style={label}>Brand</label>
                  <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Mercedes" style={input} />
                </div>
                <div style={{ ...field, flex: 1 }}>
                  <label style={label}>Model</label>
                  <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Sprinter" style={input} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ ...field, flex: 1 }}>
                  <label style={label}>Leasing Company</label>
                  <input value={leaseCompany} onChange={(e) => setLeaseCompany(e.target.value)} placeholder="e.g. ALD Automotive" style={input} />
                </div>
                <div style={{ ...field, flex: 1 }}>
                  <label style={label}>Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={input} />
                </div>
              </div>

              <div style={field}>
                <label style={label}>Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any additional details..." style={{ ...input, resize: "vertical" }} />
              </div>

              <button type="submit" disabled={submitting || !licensePlate.trim()} style={{ padding: "10px 0", borderRadius: 8, border: "none", background: submitting || !licensePlate.trim() ? "#D6D3D1" : "#D97757", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                {submitting ? "Assigning..." : "Assign Replacement"}
              </button>
            </form>
          )}

          {/* History */}
          {history.filter((r) => r.endDate).length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#A8A29E", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Past Replacements</div>
              {history.filter((r) => r.endDate).map((r) => (
                <div key={r.id} style={{ borderLeft: "3px solid #E7E5E4", paddingLeft: 14, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, color: "#1C1917" }}>{r.licensePlate}</span>
                      <span style={{ fontSize: 12, color: "#A8A29E" }}>
                        {new Date(r.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} →{" "}
                        {new Date(r.endDate!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                      </span>
                    </div>
                    {(r.brand || r.model) && <div style={{ fontSize: 13, color: "#78716C" }}>{r.brand} {r.model}</div>}
                    {r.leaseCompany && <div style={{ fontSize: 13, color: "#A8A29E" }}>{r.leaseCompany}</div>}
                  </div>
                  <button
                    onClick={() => prefillFromPast(r)}
                    style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #D97757", background: "#FFF7ED", color: "#D97757", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    Use Again
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
