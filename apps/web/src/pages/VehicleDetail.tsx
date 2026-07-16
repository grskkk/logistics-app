import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { MaintenanceLog, MaintenancePeriod, ReplacementVehicle, Vehicle } from "@logistics/shared";
import { api } from "../api/client";

const statusColor: Record<string, string> = {
  operational: "#16A34A",
  in_maintenance: "#CA8A04",
  non_operational: "#DC2626",
};

const statusLabel: Record<string, string> = {
  operational: "Operational",
  in_maintenance: "In Maintenance",
  non_operational: "Non Operational",
};

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

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const fmtDateShort = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function periodDuration(period: MaintenancePeriod): number {
  const start = new Date(period.startDate).getTime();
  const end = period.endDate ? new Date(period.endDate).getTime() : Date.now();
  return Math.max(1, Math.round((end - start) / 86400000));
}

function groupLogsByPeriod(logs: MaintenanceLog[], periods: MaintenancePeriod[]) {
  const sortedPeriods = [...periods].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
  const claimed = new Set<number>();
  const groups = sortedPeriods.map((period) => {
    const start = new Date(period.startDate).getTime();
    const end = period.endDate ? new Date(period.endDate).getTime() : Infinity;
    const periodLogs = logs.filter((log) => {
      const t = new Date(log.performedAt).getTime();
      return t >= start && t <= end;
    });
    periodLogs.forEach((log) => claimed.add(log.id));
    return { period, logs: periodLogs };
  });
  const other = logs.filter((log) => !claimed.has(log.id));
  return { groups, other };
}

const card: React.CSSProperties = {
  background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12,
  padding: 20, marginBottom: 16,
};
const cardTitle: React.CSSProperties = { fontWeight: 800, fontSize: 15, color: "var(--text)", marginBottom: 14 };
const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" };
const inputStyle: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 14, background: "var(--panel)", color: "var(--text)", fontFamily: "inherit" };
const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  padding: "9px 18px", borderRadius: 8, border: "none",
  background: disabled ? "var(--border-strong)" : "#D97757", color: "#fff",
  fontWeight: 700, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
});
const secondaryBtn: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)",
  color: "var(--text-secondary)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--text)" }}>{value ?? <span style={{ color: "var(--text-faint)" }}>—</span>}</span>
    </div>
  );
}

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Non-operational inline form
  const [showNonOpForm, setShowNonOpForm] = useState(false);
  const [nonOpName, setNonOpName] = useState("");
  const [nonOpReason, setNonOpReason] = useState("");
  const [nonOpSubmitting, setNonOpSubmitting] = useState(false);

  // Vehicle info edit
  const [editingInfo, setEditingInfo] = useState(false);
  const [licensePlate, setLicensePlate] = useState("");
  const [type, setType] = useState<Vehicle["type"]>("van");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [capacityLiters, setCapacityLiters] = useState("");
  const [leaseStartDate, setLeaseStartDate] = useState("");
  const [leaseCompany, setLeaseCompany] = useState("");
  const [hub, setHub] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoError, setInfoError] = useState("");

  // Maintenance
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [periods, setPeriods] = useState<MaintenancePeriod[]>([]);
  const [workshops, setWorkshops] = useState<string[]>([]);
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  const [notes, setNotes] = useState("");
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().slice(0, 10));
  const [returnedAt, setReturnedAt] = useState("");
  const [workshop, setWorkshop] = useState("");
  const [kmAtService, setKmAtService] = useState("");
  const [submittingLog, setSubmittingLog] = useState(false);

  // Replacement
  const [activeReplacement, setActiveReplacement] = useState<ReplacementVehicle | null>(null);
  const [replacementHistory, setReplacementHistory] = useState<ReplacementVehicle[]>([]);
  const [showReplacementForm, setShowReplacementForm] = useState(false);
  const [replPlate, setReplPlate] = useState("");
  const [replBrand, setReplBrand] = useState("");
  const [replModel, setReplModel] = useState("");
  const [replType, setReplType] = useState("van");
  const [replFuelType, setReplFuelType] = useState("");
  const [replCapacityLiters, setReplCapacityLiters] = useState("");
  const [replLeaseCompany, setReplLeaseCompany] = useState("");
  const [replStartDate, setReplStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [replNotes, setReplNotes] = useState("");
  const [submittingReplacement, setSubmittingReplacement] = useState(false);

  const resetInfoFields = (v: Vehicle) => {
    setLicensePlate(v.licensePlate);
    setType(v.type);
    setBrand(v.brand ?? "");
    setModel(v.model ?? "");
    setFuelType(v.fuelType ?? "");
    setCapacityLiters(v.capacityLiters?.toString() ?? "");
    setLeaseStartDate(v.leaseStartDate ? v.leaseStartDate.slice(0, 10) : "");
    setLeaseCompany(v.leaseCompany ?? "");
    setHub(v.hub ?? "");
  };

  const loadVehicle = () => {
    api.get<Vehicle>(`/vehicles/${id}`)
      .then((v) => { setVehicle(v); resetInfoFields(v); })
      .catch(() => setNotFound(true));
  };

  const loadMaintenance = () => {
    api.get<MaintenanceLog[]>(`/maintenance/${id}`).then(setLogs).catch(console.error);
    api.get<MaintenancePeriod[]>(`/maintenance/${id}/periods`).then(setPeriods).catch(console.error);
  };

  const loadReplacements = () => {
    api.get<ReplacementVehicle | null>(`/replacements/${id}`).then(setActiveReplacement).catch(console.error);
    api.get<ReplacementVehicle[]>(`/replacements/${id}/history`).then(setReplacementHistory).catch(console.error);
  };

  useEffect(() => {
    loadVehicle();
    loadMaintenance();
    loadReplacements();
  }, [id]);

  useEffect(() => {
    api.get<string[]>("/maintenance/workshops/all").then(setWorkshops).catch(console.error);
  }, []);

  const updateStatus = async (status: string) => {
    const updated = await api.put<Vehicle>(`/vehicles/${id}`, { status });
    setVehicle(updated);
  };

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "non_operational") {
      setShowNonOpForm(true);
    } else {
      updateStatus(newStatus);
    }
  };

  const handleConfirmNonOp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nonOpName.trim() || !nonOpReason.trim()) return;
    setNonOpSubmitting(true);
    try {
      const updated = await api.put<Vehicle>(`/vehicles/${id}`, {
        status: "non_operational",
        nonOperationalBy: nonOpName.trim(),
        nonOperationalReason: nonOpReason.trim(),
      });
      setVehicle(updated);
      setShowNonOpForm(false);
      setNonOpName("");
      setNonOpReason("");
    } finally {
      setNonOpSubmitting(false);
    }
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInfo(true);
    setInfoError("");
    try {
      const updated = await api.put<Vehicle>(`/vehicles/${id}`, {
        licensePlate,
        type,
        brand: brand || null,
        model: model || null,
        fuelType: fuelType || null,
        capacityLiters: capacityLiters ? parseFloat(capacityLiters) : null,
        leaseStartDate: leaseStartDate || null,
        leaseCompany: leaseCompany || null,
        hub: hub || null,
      });
      setVehicle(updated);
      setEditingInfo(false);
    } catch {
      setInfoError("Failed to save changes.");
    } finally {
      setSavingInfo(false);
    }
  };

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingLog(true);
    try {
      await api.post(`/maintenance/${id}`, {
        serviceType, notes: notes || null, performedAt,
        returnedAt: returnedAt || null,
        workshop: workshop || null,
        kmAtService: kmAtService ? parseInt(kmAtService) : null,
      });
      setNotes(""); setServiceType(SERVICE_TYPES[0]);
      setPerformedAt(new Date().toISOString().slice(0, 10));
      setReturnedAt("");
      setWorkshop(""); setKmAtService("");
      loadMaintenance();
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleAssignReplacement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReplacement(true);
    try {
      await api.post(`/replacements/${id}`, {
        licensePlate: replPlate.toUpperCase().replace(/-/g, ""),
        brand: replBrand || null,
        model: replModel || null,
        type: replType,
        fuelType: replFuelType || null,
        capacityLiters: replCapacityLiters ? parseFloat(replCapacityLiters) : null,
        leaseCompany: replLeaseCompany || null,
        startDate: replStartDate,
        notes: replNotes || null,
      });
      setReplPlate(""); setReplBrand(""); setReplModel(""); setReplFuelType(""); setReplCapacityLiters(""); setReplLeaseCompany(""); setReplNotes("");
      loadReplacements();
    } finally {
      setSubmittingReplacement(false);
    }
  };

  const handleReturnReplacement = async () => {
    if (!activeReplacement) return;
    await api.put(`/replacements/${activeReplacement.id}/return`, {});
    loadReplacements();
  };

  const prefillFromPast = (r: ReplacementVehicle) => {
    setReplPlate(r.licensePlate);
    setReplBrand(r.brand ?? "");
    setReplModel(r.model ?? "");
    setReplType(r.type ?? "van");
    setReplFuelType(r.fuelType ?? "");
    setReplCapacityLiters(r.capacityLiters?.toString() ?? "");
    setReplLeaseCompany(r.leaseCompany ?? "");
    setReplStartDate(new Date().toISOString().slice(0, 10));
    setReplNotes("");
    setShowReplacementForm(true);
    setTimeout(() => document.getElementById("replacement-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const archiveVehicle = async () => {
    const updated = await api.put<Vehicle>(`/vehicles/${id}`, { archived: !vehicle?.archived });
    setVehicle(updated);
  };

  if (notFound) {
    return (
      <div className="page">
        <Link to="/fleet" style={{ color: "#D97757", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>← Back to Fleet</Link>
        <p style={{ marginTop: 20, color: "var(--text-muted)" }}>Vehicle not found.</p>
      </div>
    );
  }

  if (!vehicle) {
    return <div className="page"><p style={{ color: "var(--text-muted)" }}>Loading…</p></div>;
  }

  return (
    <div className="page" style={{ maxWidth: 760, margin: "0 auto" }}>
      <Link to="/fleet" style={{ color: "#D97757", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>← Back to Fleet</Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 12, marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{vehicle.licensePlate}</h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 14, textTransform: "capitalize" }}>
            {vehicle.type} {vehicle.hub ? `· ${vehicle.hub}` : ""}
          </p>
        </div>
        <select
          value={vehicle.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          style={{
            background: statusColor[vehicle.status] + "22",
            color: statusColor[vehicle.status],
            border: `1px solid ${statusColor[vehicle.status]}44`,
            borderRadius: 12, padding: "6px 14px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {Object.entries(statusLabel).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {showNonOpForm && (
        <div style={{ ...card, border: "1px solid var(--danger-soft-border)", background: "var(--danger-soft-bg)" }}>
          <div style={{ ...cardTitle, color: "var(--danger-soft-text)" }}>Mark Non-Operational</div>
          <form onSubmit={handleConfirmNonOp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Your name *</label>
              <input autoFocus value={nonOpName} onChange={(e) => setNonOpName(e.target.value)} placeholder="e.g. Giorgos" style={inputStyle} />
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>So teammates know who flagged this vehicle.</span>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Reason *</label>
              <textarea value={nonOpReason} onChange={(e) => setNonOpReason(e.target.value)} placeholder="e.g. Won't start, accident damage, flat tire..." rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setShowNonOpForm(false)} style={secondaryBtn}>Cancel</button>
              <button type="submit" disabled={nonOpSubmitting || !nonOpName.trim() || !nonOpReason.trim()} style={primaryBtn(nonOpSubmitting || !nonOpName.trim() || !nonOpReason.trim())}>
                {nonOpSubmitting ? "Saving..." : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      )}

      {!showNonOpForm && vehicle.status === "non_operational" && vehicle.nonOperationalBy && (
        <div style={{ ...card, border: "1px solid var(--danger-soft-border)", background: "var(--danger-soft-bg)" }}>
          <div style={{ fontSize: 13, color: "var(--danger-soft-text)" }}>
            Flagged by <strong>{vehicle.nonOperationalBy}</strong>
            {vehicle.nonOperationalReason && <>: {vehicle.nonOperationalReason}</>}
          </div>
        </div>
      )}

      {/* Vehicle info */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={cardTitle}>Vehicle Info</div>
          {!editingInfo && (
            <button onClick={() => { resetInfoFields(vehicle); setEditingInfo(true); }} style={secondaryBtn}>Edit</button>
          )}
        </div>

        {!editingInfo ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
            <InfoRow label="Brand" value={vehicle.brand} />
            <InfoRow label="Model" value={vehicle.model} />
            <InfoRow label="Type" value={<span style={{ textTransform: "capitalize" }}>{vehicle.type}</span>} />
            <InfoRow label="Hub" value={vehicle.hub} />
            <InfoRow label="Fuel Type" value={vehicle.fuelType && <span style={{ textTransform: "capitalize" }}>{vehicle.fuelType}</span>} />
            <InfoRow label="Capacity (L)" value={vehicle.capacityLiters} />
            <InfoRow label="Leasing Company" value={vehicle.leaseCompany} />
            <InfoRow label="Lease Start Date" value={vehicle.leaseStartDate ? fmtDate(vehicle.leaseStartDate) : null} />
            <InfoRow label="Driver ID" value={vehicle.driverId} />
            <InfoRow label="Archived" value={vehicle.archived ? "Yes" : "No"} />
            <InfoRow label="Last Updated" value={vehicle.updatedAt ? fmtDate(vehicle.updatedAt) : null} />
          </div>
        ) : (
          <form onSubmit={handleSaveInfo} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>License Plate</label>
              <input value={licensePlate} onChange={(e) => setLicensePlate(e.target.value.toUpperCase().replace(/-/g, ""))} style={inputStyle} />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ ...fieldStyle, flex: 1 }}>
                <label style={labelStyle}>Brand</label>
                <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Mercedes" style={inputStyle} />
              </div>
              <div style={{ ...fieldStyle, flex: 1 }}>
                <label style={labelStyle}>Model</label>
                <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Sprinter" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ ...fieldStyle, flex: 1 }}>
                <label style={labelStyle}>Vehicle Type</label>
                <select value={type} onChange={(e) => setType(e.target.value as Vehicle["type"])} style={inputStyle}>
                  <option value="van">Van</option>
                  <option value="car">Car</option>
                </select>
              </div>
              <div style={{ ...fieldStyle, flex: 1 }}>
                <label style={labelStyle}>Fuel Type</label>
                <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} style={inputStyle}>
                  <option value="">— Select —</option>
                  <option value="gas">Gas</option>
                  <option value="diesel">Diesel</option>
                  <option value="electric">Electric</option>
                </select>
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Capacity (liters)</label>
              <input type="number" min="0" step="0.1" value={capacityLiters} onChange={(e) => setCapacityLiters(e.target.value)} placeholder="e.g. 1200" style={inputStyle} />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ ...fieldStyle, flex: 1 }}>
                <label style={labelStyle}>Leasing Company</label>
                <select value={leaseCompany} onChange={(e) => setLeaseCompany(e.target.value)} style={inputStyle}>
                  <option value="">— None —</option>
                  <option>Avis</option>
                  <option>Ayvens</option>
                  <option>LeasePlan</option>
                </select>
              </div>
              <div style={{ ...fieldStyle, flex: 1 }}>
                <label style={labelStyle}>Hub</label>
                <select value={hub} onChange={(e) => setHub(e.target.value)} style={inputStyle}>
                  <option value="">— None —</option>
                  <option>Athens</option>
                  <option>Alimos</option>
                  <option>Menidi</option>
                  <option>Mandra</option>
                  <option>Paiania</option>
                </select>
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Lease Start Date</label>
              <input type="date" value={leaseStartDate} onChange={(e) => setLeaseStartDate(e.target.value)} style={inputStyle} />
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Leave blank if vehicle is owned</span>
            </div>

            {infoError && <span style={{ color: "var(--danger-soft-text)", fontSize: 13 }}>{infoError}</span>}

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setEditingInfo(false)} style={secondaryBtn}>Cancel</button>
              <button type="submit" disabled={savingInfo} style={primaryBtn(savingInfo)}>{savingInfo ? "Saving..." : "Save Changes"}</button>
            </div>
          </form>
        )}
      </div>

      {/* Maintenance */}
      <div style={card}>
        <div style={cardTitle}>Maintenance</div>

        <form onSubmit={handleLogSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22, paddingBottom: 22, borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>Log New Service</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px", ...fieldStyle }}>
              <label style={labelStyle}>Service Type</label>
              <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} style={inputStyle}>
                {SERVICE_TYPES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ flex: "1 1 130px", ...fieldStyle }}>
              <label style={labelStyle}>Date in</label>
              <input type="date" value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: "1 1 130px", ...fieldStyle }}>
              <label style={labelStyle}>Date out (optional)</label>
              <input type="date" value={returnedAt} onChange={(e) => setReturnedAt(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px", ...fieldStyle }}>
              <label style={labelStyle}>Workshop (optional)</label>
              <select value={workshop} onChange={(e) => setWorkshop(e.target.value)} style={inputStyle}>
                <option value="">Select workshop...</option>
                {workshops.map((w) => <option key={w}>{w}</option>)}
              </select>
            </div>
            <div style={{ width: 130, ...fieldStyle }}>
              <label style={labelStyle}>KM at service</label>
              <input type="number" value={kmAtService} onChange={(e) => setKmAtService(e.target.value)} placeholder="e.g. 45000" style={inputStyle} />
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Replaced front brake pads, rear at 60%..." rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div>
            <button type="submit" disabled={submittingLog} style={primaryBtn(submittingLog)}>{submittingLog ? "Saving..." : "Save Record"}</button>
          </div>
        </form>

        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 14 }}>
            History {logs.length > 0 && <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>({logs.length} records)</span>}
          </div>
          {logs.length === 0 && (
            <div style={{ color: "var(--text-faint)", fontSize: 14 }}>No maintenance records yet.</div>
          )}
          {(() => {
            const { groups, other } = groupLogsByPeriod(logs, periods);
            const renderLog = (log: MaintenanceLog) => (
              <div key={log.id} style={{ borderLeft: "3px solid #D97757", paddingLeft: 14, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{log.serviceType}</span>
                  <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                    {log.returnedAt ? `${fmtDate(log.performedAt)} → ${fmtDate(log.returnedAt)}` : fmtDate(log.performedAt)}
                  </span>
                </div>
                {(log.workshop || log.kmAtService) && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, display: "flex", gap: 12 }}>
                    {log.workshop && <span>📍 {log.workshop}</span>}
                    {log.kmAtService && <span>⟳ {log.kmAtService.toLocaleString()} km</span>}
                  </div>
                )}
                {log.notes && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{log.notes}</div>}
              </div>
            );

            return (
              <>
                {groups.map(({ period, logs: periodLogs }) => (
                  <div key={period.id} style={{ marginBottom: 22 }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap",
                      background: "var(--accent-soft-bg)", border: "1px solid var(--accent-soft-border)", borderRadius: 8, padding: "8px 12px",
                    }}>
                      <span style={{ fontSize: 13 }}>🔧</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-soft-text)" }}>
                        In maintenance {fmtDate(period.startDate)} → {period.endDate ? fmtDate(period.endDate) : "Ongoing"}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--accent-soft-text)", opacity: 0.7 }}>
                        ({periodDuration(period)} {periodDuration(period) === 1 ? "day" : "days"})
                      </span>
                    </div>
                    {periodLogs.length > 0 ? (
                      <div style={{ paddingLeft: 4 }}>{periodLogs.map(renderLog)}</div>
                    ) : (
                      <div style={{ fontSize: 13, color: "var(--text-faint)", paddingLeft: 18, marginBottom: 4 }}>No work logged for this period.</div>
                    )}
                  </div>
                ))}
                {other.length > 0 && (
                  <div>
                    {groups.length > 0 && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                        Other Records
                      </div>
                    )}
                    {other.map(renderLog)}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Replacement */}
      {vehicle.status === "in_maintenance" && (
        <div style={card}>
          <div style={cardTitle}>Replacement Vehicle</div>

          {activeReplacement && (
            <div style={{ background: "var(--accent-soft-bg)", border: "1px solid var(--accent-soft-border)", borderRadius: 10, padding: 16, marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent-soft-text)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                Active Replacement
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>{activeReplacement.licensePlate}</span>
                  {(activeReplacement.brand || activeReplacement.model) && <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{activeReplacement.brand} {activeReplacement.model}</span>}
                  {(activeReplacement.type || activeReplacement.fuelType || activeReplacement.capacityLiters) && (
                    <span style={{ color: "var(--text-muted)", fontSize: 13, textTransform: "capitalize" }}>
                      {[activeReplacement.type, activeReplacement.fuelType, activeReplacement.capacityLiters ? `${activeReplacement.capacityLiters}L` : null].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  {activeReplacement.leaseCompany && <span style={{ color: "var(--text-muted)", fontSize: 13 }}>From: {activeReplacement.leaseCompany}</span>}
                  <span style={{ color: "var(--text-faint)", fontSize: 12 }}>Since {fmtDate(activeReplacement.startDate)}</span>
                  {activeReplacement.notes && <span style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>{activeReplacement.notes}</span>}
                </div>
                <button onClick={handleReturnReplacement} style={{ ...secondaryBtn, border: "1px solid var(--accent-soft-border)", color: "var(--accent-soft-text)", background: "var(--panel)", whiteSpace: "nowrap" }}>
                  Mark Returned
                </button>
              </div>
              <button
                onClick={() => setShowReplacementForm((v) => !v)}
                style={{ marginTop: 12, fontSize: 13, color: "#D97757", background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0, fontFamily: "inherit" }}
              >
                {showReplacementForm ? "▲ Hide form" : "▼ Assign different replacement"}
              </button>
            </div>
          )}

          {(showReplacementForm || !activeReplacement) && (
            <form id="replacement-form" onSubmit={handleAssignReplacement} style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>
                {activeReplacement ? "Assign Different Replacement" : "Assign Replacement Vehicle"}
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>License Plate *</label>
                <input value={replPlate} onChange={(e) => setReplPlate(e.target.value.toUpperCase().replace(/-/g, ""))} placeholder="e.g. ABC1234" required style={inputStyle} />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ ...fieldStyle, flex: 1 }}>
                  <label style={labelStyle}>Brand</label>
                  <input value={replBrand} onChange={(e) => setReplBrand(e.target.value)} placeholder="e.g. Mercedes" style={inputStyle} />
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                  <label style={labelStyle}>Model</label>
                  <input value={replModel} onChange={(e) => setReplModel(e.target.value)} placeholder="e.g. Sprinter" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ ...fieldStyle, flex: 1 }}>
                  <label style={labelStyle}>Vehicle Type</label>
                  <select value={replType} onChange={(e) => setReplType(e.target.value)} style={inputStyle}>
                    <option value="van">Van</option>
                    <option value="car">Car</option>
                  </select>
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                  <label style={labelStyle}>Fuel Type</label>
                  <select value={replFuelType} onChange={(e) => setReplFuelType(e.target.value)} style={inputStyle}>
                    <option value="">— Select —</option>
                    <option value="gas">Gas</option>
                    <option value="diesel">Diesel</option>
                    <option value="electric">Electric</option>
                  </select>
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Capacity (liters)</label>
                <input type="number" min="0" step="0.1" value={replCapacityLiters} onChange={(e) => setReplCapacityLiters(e.target.value)} placeholder="e.g. 1200" style={inputStyle} />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ ...fieldStyle, flex: 1 }}>
                  <label style={labelStyle}>Leasing Company</label>
                  <select value={replLeaseCompany} onChange={(e) => setReplLeaseCompany(e.target.value)} style={inputStyle}>
                    <option value="">— None —</option>
                    <option>Avis</option>
                    <option>Ayvens</option>
                    <option>LeasePlan</option>
                  </select>
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                  <label style={labelStyle}>Start Date</label>
                  <input type="date" value={replStartDate} onChange={(e) => setReplStartDate(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Notes (optional)</label>
                <textarea value={replNotes} onChange={(e) => setReplNotes(e.target.value)} rows={2} placeholder="Any additional details..." style={{ ...inputStyle, resize: "vertical" }} />
              </div>

              <div>
                <button type="submit" disabled={submittingReplacement || !replPlate.trim()} style={primaryBtn(submittingReplacement || !replPlate.trim())}>
                  {submittingReplacement ? "Assigning..." : "Assign Replacement"}
                </button>
              </div>
            </form>
          )}

          {replacementHistory.filter((r) => r.endDate).length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Past Replacements</div>
              {replacementHistory.filter((r) => r.endDate).map((r) => (
                <div key={r.id} style={{ borderLeft: "3px solid var(--border)", paddingLeft: 14, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, color: "var(--text)" }}>{r.licensePlate}</span>
                      <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                        {fmtDateShort(r.startDate)} → {fmtDate(r.endDate!)}
                      </span>
                    </div>
                    {(r.brand || r.model) && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{r.brand} {r.model}</div>}
                    {(r.type || r.fuelType || r.capacityLiters) && (
                      <div style={{ fontSize: 13, color: "var(--text-muted)", textTransform: "capitalize" }}>
                        {[r.type, r.fuelType, r.capacityLiters ? `${r.capacityLiters}L` : null].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {r.leaseCompany && <div style={{ fontSize: 13, color: "var(--text-faint)" }}>{r.leaseCompany}</div>}
                  </div>
                  <button onClick={() => prefillFromPast(r)} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #D97757", background: "var(--accent-soft-bg)", color: "#D97757", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>
                    Use Again
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ ...card, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={archiveVehicle}
          style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${vehicle.archived ? "var(--success-soft-border)" : "var(--danger-soft-border)"}`, background: vehicle.archived ? "var(--success-soft-bg)" : "var(--danger-soft-bg)", fontSize: 13, fontWeight: 700, cursor: "pointer", color: vehicle.archived ? "var(--success-soft-text)" : "var(--danger-soft-text)", fontFamily: "inherit" }}
        >
          {vehicle.archived ? "Restore Vehicle" : "Archive Vehicle"}
        </button>
      </div>
    </div>
  );
}
