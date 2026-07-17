import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Appointment, AppointmentStatus, Vehicle } from "@logistics/shared";
import { api } from "../api/client";

const statusMeta: Record<AppointmentStatus, { label: string; color: string }> = {
  scheduled: { label: "Scheduled", color: "#2563EB" },
  completed: { label: "Completed", color: "#16A34A" },
  cancelled: { label: "Cancelled", color: "#DC2626" },
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

// ISO timestamp -> value for <input type="datetime-local"> (local time).
function toInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputStyle: React.CSSProperties = {
  padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 14,
  background: "var(--panel)", color: "var(--text)", fontFamily: "inherit", width: "100%", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4, display: "block" };
const th: React.CSSProperties = { textAlign: "left", fontSize: 11, fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 0.5, padding: "8px 12px", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px 12px", fontSize: 14, color: "var(--text)", borderTop: "1px solid var(--border)", verticalAlign: "top" };

type Draft = {
  id?: number;
  vehiclePlate: string;
  scheduledAt: string;
  workshop: string;
  reason: string;
  notes: string;
  status: AppointmentStatus;
};

const emptyDraft: Draft = { vehiclePlate: "", scheduledAt: "", workshop: "", reason: "", notes: "", status: "scheduled" };

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [workshops, setWorkshops] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AppointmentStatus>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api.get<Appointment[]>("/appointments").then(setAppointments).catch((e) => console.error(e));

  useEffect(() => {
    Promise.all([
      api.get<Appointment[]>("/appointments").then(setAppointments),
      api.get<Vehicle[]>("/vehicles").then(setVehicles),
      api.get<string[]>("/maintenance/workshops/all").then(setWorkshops).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const plateToId = useMemo(() => {
    const m = new Map<string, number>();
    vehicles.forEach((v) => m.set(v.licensePlate.toUpperCase(), v.id));
    return m;
  }, [vehicles]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return appointments.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (q && !a.licensePlate.toUpperCase().includes(q) && !(a.reason ?? "").toUpperCase().includes(q)) return false;
      return true;
    });
  }, [appointments, search, statusFilter]);

  const now = Date.now();
  const upcoming = filtered.filter((a) => a.status === "scheduled" && new Date(a.scheduledAt).getTime() >= now);
  const past = filtered.filter((a) => !(a.status === "scheduled" && new Date(a.scheduledAt).getTime() >= now));

  const openNew = () => { setDraft(emptyDraft); setError(null); setModalOpen(true); };
  const openEdit = (a: Appointment) => {
    setDraft({
      id: a.id, vehiclePlate: a.licensePlate, scheduledAt: toInputValue(a.scheduledAt),
      workshop: a.workshop ?? "", reason: a.reason, notes: a.notes ?? "", status: a.status,
    });
    setError(null);
    setModalOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const vehicleId = plateToId.get(draft.vehiclePlate.trim().toUpperCase());
    if (!vehicleId) return setError("Pick a valid vehicle license plate from the fleet.");
    if (!draft.scheduledAt) return setError("Choose a date and time.");
    if (!draft.reason.trim()) return setError("Enter a reason for the appointment.");

    setSaving(true);
    const body = {
      vehicleId,
      scheduledAt: new Date(draft.scheduledAt).toISOString(),
      workshop: draft.workshop.trim() || null,
      reason: draft.reason.trim(),
      notes: draft.notes.trim() || null,
      status: draft.status,
    };
    try {
      if (draft.id) await api.put(`/appointments/${draft.id}`, body);
      else await api.post("/appointments", body);
      await load();
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save appointment");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Appointment) => {
    if (!window.confirm(`Delete the ${a.reason} appointment for ${a.licensePlate}?`)) return;
    try {
      await api.del(`/appointments/${a.id}`);
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  const markStatus = async (a: Appointment, status: AppointmentStatus) => {
    try {
      await api.put(`/appointments/${a.id}`, { status });
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  const renderTable = (list: Appointment[], emptyMsg: string) => (
    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 12, background: "var(--panel)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
        <thead>
          <tr>
            <th style={th}>Vehicle</th>
            <th style={th}>Hub</th>
            <th style={th}>Date &amp; time</th>
            <th style={th}>Workshop</th>
            <th style={th}>Reason</th>
            <th style={th}>Status</th>
            <th style={{ ...th, textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr><td style={{ ...td, color: "var(--text-faint)" }} colSpan={7}>{emptyMsg}</td></tr>
          )}
          {list.map((a) => (
            <tr key={a.id}>
              <td style={{ ...td, fontWeight: 700 }}>{a.licensePlate}</td>
              <td style={td}>{a.hub || <span style={{ color: "var(--text-faint)" }}>—</span>}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDateTime(a.scheduledAt)}</td>
              <td style={td}>{a.workshop || <span style={{ color: "var(--text-faint)" }}>—</span>}</td>
              <td style={td}>
                {a.reason}
                {a.notes && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{a.notes}</div>}
              </td>
              <td style={td}>
                <span style={{
                  display: "inline-block", padding: "2px 9px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  color: statusMeta[a.status].color, background: `${statusMeta[a.status].color}22`,
                }}>{statusMeta[a.status].label}</span>
              </td>
              <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                {a.status === "scheduled" && (
                  <button onClick={() => markStatus(a, "completed")} title="Mark completed" style={iconBtn}>✓</button>
                )}
                <button onClick={() => openEdit(a)} title="Edit" style={iconBtn}>✎</button>
                <button onClick={() => remove(a)} title="Delete" style={{ ...iconBtn, color: "#DC2626" }}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--text)" }}>Appointments</h1>
          <div style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 2 }}>Ραντεβού — scheduled workshop visits</div>
        </div>
        <button onClick={openNew} style={primaryBtn}>+ New Appointment</button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plate or reason…"
          style={{ ...inputStyle, width: 260 }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} style={{ ...inputStyle, width: 160 }}>
          <option value="all">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div style={{ color: "var(--text-faint)" }}>Loading…</div>
      ) : (
        <>
          <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px" }}>
            Upcoming ({upcoming.length})
          </div>
          {renderTable(upcoming, "No upcoming appointments.")}

          <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, margin: "26px 0 10px" }}>
            Past &amp; closed ({past.length})
          </div>
          {renderTable(past, "Nothing here yet.")}
        </>
      )}

      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, zIndex: 50, overflowY: "auto" }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 480, marginTop: 40, boxShadow: "var(--shadow-modal)" }}
          >
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: "var(--text)" }}>
              {draft.id ? "Edit appointment" : "New appointment"}
            </h2>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Vehicle (license plate)</label>
              <input list="vehicle-plates" value={draft.vehiclePlate} onChange={(e) => setDraft({ ...draft, vehiclePlate: e.target.value })} placeholder="e.g. ZTZ8134" style={inputStyle} autoFocus />
              <datalist id="vehicle-plates">
                {vehicles.map((v) => <option key={v.id} value={v.licensePlate}>{v.brand} {v.model}</option>)}
              </datalist>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Date &amp; time</label>
              <input type="datetime-local" value={draft.scheduledAt} onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Workshop (optional)</label>
              <input list="workshop-list" value={draft.workshop} onChange={(e) => setDraft({ ...draft, workshop: e.target.value })} placeholder="Select or type…" style={inputStyle} />
              <datalist id="workshop-list">
                {workshops.map((w) => <option key={w} value={w} />)}
              </datalist>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Reason</label>
              <input list="reason-list" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} placeholder="e.g. Service, KTEO, Brakes…" style={inputStyle} />
              <datalist id="reason-list">
                {["Service", "KTEO", "Brakes", "Tire change", "Bodywork", "Battery", "General check"].map((r) => <option key={r} value={r} />)}
              </datalist>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            {draft.id && (
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Status</label>
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as AppointmentStatus })} style={inputStyle}>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}

            {error && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button type="button" onClick={() => setModalOpen(false)} style={secondaryBtn}>Cancel</button>
              <button type="submit" disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : draft.id ? "Save changes" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 8, border: "none", background: "#D97757", color: "#fff",
  fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
};
const secondaryBtn: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)",
  color: "var(--text-secondary)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
};
const iconBtn: React.CSSProperties = {
  background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer",
  padding: "4px 8px", marginLeft: 6, fontSize: 13, color: "var(--text-secondary)", fontFamily: "inherit",
};
