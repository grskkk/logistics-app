import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Vehicle } from "@logistics/shared";
import { api } from "../api/client";
import MaintenanceDrawer from "../components/MaintenanceDrawer";
import VehicleEditDrawer from "../components/VehicleEditDrawer";
import AddVehicleModal from "../components/AddVehicleModal";
import ReplacementVehicleModal from "../components/ReplacementVehicleModal";
import MarkNonOperationalModal from "../components/MarkNonOperationalModal";

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

type FilterOption = { value: string; label: string; count: number; color?: string; indent?: boolean };

function FilterDropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];
  const active = value !== "all";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          background: active ? "#1C1917" : "#fff",
          color: active ? "#fff" : "#57534E",
          border: `1px solid ${active ? "transparent" : "#E7E5E4"}`,
        }}
      >
        <span style={{ opacity: 0.6, fontWeight: 800, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </span>
        {selected.color && !active && (
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: selected.color, flexShrink: 0 }} />
        )}
        <span>{selected.label}</span>
        <span style={{ opacity: 0.65 }}>({selected.count})</span>
        <span style={{ fontSize: 9, opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20,
            background: "#fff", border: "1px solid #E7E5E4", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.14)", minWidth: 210, padding: 4,
          }}
        >
          {options.map((o) => {
            const isActive = o.value === value;
            return (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
                  padding: "7px 10px", paddingLeft: o.indent ? 26 : 10, borderRadius: 6, border: "none",
                  background: isActive ? "#F5F5F4" : "transparent",
                  color: "#1C1917", fontWeight: isActive ? 700 : 500, fontSize: o.indent ? 12.5 : 13,
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  {o.color && (
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: o.color, flexShrink: 0 }} />
                  )}
                  {o.label}
                </span>
                <span style={{ opacity: 0.5, fontSize: 12 }}>{o.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Fleet() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [replacementVehicle, setReplacementVehicle] = useState<Vehicle | null>(null);
  const [nonOpVehicle, setNonOpVehicle] = useState<Vehicle | null>(null);
  const [hoveredReasonId, setHoveredReasonId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<"id" | "plate" | "flaggedBy">("id");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterHub, setFilterHub] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterFlaggedBy, setFilterFlaggedBy] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const plateFilter = searchParams.get("plate");
  const matchesSearch = (v: Vehicle) =>
    !search.trim() || v.licensePlate.toLowerCase().includes(search.trim().toLowerCase());
  const matchesFlaggedBy = (v: Vehicle) =>
    filterFlaggedBy === "all" || v.nonOperationalBy === filterFlaggedBy;

  const handleSort = (field: "id" | "plate" | "flaggedBy") => {
    if (sortField === field) setSortAsc((v) => !v);
    else { setSortField(field); setSortAsc(true); }
  };

  const load = (archived = showArchived) => {
    api.get<Vehicle[]>(`/vehicles?archived=${archived}`).then(setVehicles).catch(console.error);
  };

  const updateStatus = async (id: number, status: string) => {
    await api.put(`/vehicles/${id}`, { status });
    await load();
  };

  const archiveVehicle = async (id: number) => {
    await api.put(`/vehicles/${id}`, { archived: true });
    await load();
  };

  const unarchiveVehicle = async (id: number) => {
    await api.put(`/vehicles/${id}`, { archived: false });
    await load();
  };

  useEffect(() => { load(showArchived); }, [showArchived]);


  return (
    <div className="page">
      <div className="page-header">
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#1C1917" }}>{showArchived ? "Archived Vehicles" : "Fleet"}</h1>
          <p style={{ margin: "4px 0 0", color: "#78716C", fontSize: 14 }}>{showArchived ? "Restore or review archived vehicles" : "Manage your vehicle fleet"}</p>
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search license plate…"
            style={{
              padding: "8px 14px", borderRadius: 8, border: "1px solid #D6D3D1",
              fontSize: 13, fontFamily: "inherit", width: 240, color: "#1C1917",
            }}
          />
        </div>
        <div style={{ flex: 1, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
          <button
            onClick={() => setShowArchived((v) => !v)}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #D6D3D1", background: showArchived ? "#1C1917" : "#fff", color: showArchived ? "#fff" : "#57534E", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
          >
            {showArchived ? "← Active" : "Archived"}
          </button>
          {!showArchived && (
            <button
              onClick={() => setShowAddModal(true)}
              style={{ padding: "8px 20px", borderRadius: 8, background: "#D97757", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
            >
              + Add Vehicle
            </button>
          )}
        </div>
      </div>

      {!showArchived && plateFilter && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 12,
          padding: "10px 16px", marginBottom: 16,
        }}>
          <span style={{ fontSize: 13, color: "#C2410C" }}>
            Filtered from an alert — showing <strong>{plateFilter}</strong>
          </span>
          <button
            onClick={() => setSearchParams({})}
            style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "transparent", color: "#C2410C", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
          >
            Clear ✕
          </button>
        </div>
      )}

      {!showArchived && !plateFilter && (() => {
        const types = ["van", "car"];
        const typeLabel: Record<string, string> = { van: "Van", car: "Car" };
        const hubs = ["Athens", "Alimos", "Menidi", "Mandra", "Paiania"];

        const matchesStatus = (v: Vehicle) =>
          filterStatus === "all" ? true
          : filterStatus === "in_maintenance_repl" ? v.status === "in_maintenance" && v.hasActiveReplacement
          : filterStatus === "in_maintenance_no_repl" ? v.status === "in_maintenance" && !v.hasActiveReplacement
          : v.status === filterStatus;
        const matchesHub = (v: Vehicle) => filterHub === "all" || v.hub === filterHub;
        const matchesType = (v: Vehicle) => filterType === "all" || v.type === filterType;

        const filteredVehicles = vehicles.filter((v) => matchesStatus(v) && matchesHub(v) && matchesType(v) && matchesSearch(v) && matchesFlaggedBy(v));
        const filtersActive = filterStatus !== "all" || filterHub !== "all" || filterType !== "all" || filterFlaggedBy !== "all" || search.trim() !== "";

        const typeOptions: FilterOption[] = (["all", ...types] as string[]).map((t) => ({
          value: t,
          label: t === "all" ? "All Types" : typeLabel[t],
          count: vehicles.filter((v) => matchesStatus(v) && matchesHub(v) && matchesSearch(v) && matchesFlaggedBy(v) && (t === "all" || v.type === t)).length,
        }));
        const hubOptions: FilterOption[] = (["all", ...hubs] as string[]).map((hub) => ({
          value: hub,
          label: hub === "all" ? "All Hubs" : hub,
          count: vehicles.filter((v) => matchesStatus(v) && matchesType(v) && matchesSearch(v) && matchesFlaggedBy(v) && (hub === "all" || v.hub === hub)).length,
        }));
        const statusOptions: FilterOption[] = ([
          ["all", "All", "#57534E"],
          ["operational", "Operational", "#16A34A"],
          ["in_maintenance", "In Maintenance", "#CA8A04"],
          ["in_maintenance_repl", "With Replacement", "#CA8A04"],
          ["in_maintenance_no_repl", "No Replacement", "#CA8A04"],
          ["non_operational", "Non Operational", "#DC2626"],
        ] as [string, string, string][]).map(([val, lbl, color]) => ({
          value: val,
          label: lbl,
          color,
          indent: val.startsWith("in_maintenance_"),
          count: vehicles.filter((v) => {
            if (!matchesHub(v) || !matchesType(v) || !matchesSearch(v) || !matchesFlaggedBy(v)) return false;
            if (val === "all") return true;
            if (val === "in_maintenance_repl") return v.status === "in_maintenance" && v.hasActiveReplacement;
            if (val === "in_maintenance_no_repl") return v.status === "in_maintenance" && !v.hasActiveReplacement;
            return v.status === val;
          }).length,
        }));

        const flaggedByNames = [...new Set(vehicles.filter((v) => v.nonOperationalBy).map((v) => v.nonOperationalBy as string))].sort();
        const flaggedByOptions: FilterOption[] = ["all", ...flaggedByNames].map((name) => ({
          value: name,
          label: name === "all" ? "Anyone" : name,
          count: vehicles.filter((v) => matchesStatus(v) && matchesHub(v) && matchesType(v) && matchesSearch(v) && (name === "all" || v.nonOperationalBy === name)).length,
        }));

        return (
          <div
            style={{
              background: "#fff",
              border: `1px solid ${filtersActive ? "#D97757" : "#E7E5E4"}`,
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              boxShadow: filtersActive ? "0 1px 3px rgba(217,119,87,0.12)" : "none",
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <FilterDropdown label="Type" options={typeOptions} value={filterType} onChange={setFilterType} />
                <FilterDropdown label="Hub" options={hubOptions} value={filterHub} onChange={setFilterHub} />
                <FilterDropdown label="Status" options={statusOptions} value={filterStatus} onChange={setFilterStatus} />
                {flaggedByNames.length > 0 && (
                  <FilterDropdown label="Flagged By" options={flaggedByOptions} value={filterFlaggedBy} onChange={setFilterFlaggedBy} />
                )}
                {filtersActive && (
                  <button
                    onClick={() => { setFilterStatus("all"); setFilterHub("all"); setFilterType("all"); setFilterFlaggedBy("all"); }}
                    style={{
                      padding: "6px 10px", borderRadius: 8, border: "none", background: "transparent",
                      color: "#A8A29E", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    Clear ✕
                  </button>
                )}
              </div>
              <div
                style={{
                  display: "flex", alignItems: "baseline", gap: 6,
                  padding: "5px 12px", borderRadius: 20,
                  background: filtersActive ? "#FFF7ED" : "#FAF9F7",
                  border: `1px solid ${filtersActive ? "#FED7AA" : "#E7E5E4"}`,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 800, color: filtersActive ? "#C2410C" : "#1C1917" }}>
                  {filteredVehicles.length}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#78716C" }}>
                  {filteredVehicles.length === 1 ? "vehicle" : "vehicles"}
                  {filtersActive && <> matching filters</>}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="table-wrapper">
      <table>
        <thead>
          <tr style={{ background: "#FAF9F7", textAlign: "left", borderBottom: "1px solid #E7E5E4" }}>
            <th style={{ padding: "12px 16px" }}>ID</th>
            <th style={{ padding: "12px 16px" }}>
              <button
                onClick={() => handleSort("plate")}
                style={{ background: "none", border: "none", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0, color: sortField === "plate" ? "#1C1917" : "#57534E" }}
              >
                License Plate {sortField === "plate" ? (sortAsc ? "↑" : "↓") : "↕"}
              </button>
            </th>
            <th style={{ padding: "12px 16px" }}>Brand & Model</th>
            <th style={{ padding: "12px 16px" }}>Type</th>
            <th style={{ padding: "12px 16px" }}>Hub</th>
            <th style={{ padding: "12px 16px" }}>Leasing</th>
            <th style={{ padding: "12px 16px" }}>Status</th>
            <th style={{ padding: "12px 16px" }}>
              <button
                onClick={() => handleSort("flaggedBy")}
                style={{ background: "none", border: "none", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0, color: sortField === "flaggedBy" ? "#1C1917" : "#57534E" }}
              >
                Flagged By {sortField === "flaggedBy" ? (sortAsc ? "↑" : "↓") : "↕"}
              </button>
            </th>
            <th style={{ padding: "12px 16px" }}></th>
          </tr>
        </thead>
        <tbody>
          {vehicles.length === 0 && (
            <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>No vehicles yet.</td></tr>
          )}
          {[...vehicles]
            .filter((v) => !plateFilter || v.licensePlate === plateFilter)
            .filter((v) => matchesSearch(v))
            .filter((v) => plateFilter || filterStatus === "all" ? true
              : filterStatus === "in_maintenance_repl" ? v.status === "in_maintenance" && v.hasActiveReplacement
              : filterStatus === "in_maintenance_no_repl" ? v.status === "in_maintenance" && !v.hasActiveReplacement
              : v.status === filterStatus
            )
            .filter((v) => plateFilter || filterHub === "all" || v.hub === filterHub)
            .filter((v) => plateFilter || filterType === "all" || v.type === filterType)
            .filter((v) => plateFilter || matchesFlaggedBy(v))
            .sort((a, b) => {
              const cmp = sortField === "plate" ? a.licensePlate.localeCompare(b.licensePlate)
                : sortField === "flaggedBy" ? (a.nonOperationalBy ?? "").localeCompare(b.nonOperationalBy ?? "")
                : a.id - b.id;
              return sortAsc ? cmp : -cmp;
            })
            .map((v) => (
            <tr key={v.id} style={{ borderTop: "1px solid #F5F5F4" }}>
              <td style={{ padding: "12px 16px" }}>{v.id}</td>
              <td style={{ padding: "12px 16px", fontWeight: 600 }}>{v.licensePlate}</td>
              <td style={{ padding: "12px 16px" }}>
                {v.brand || v.model
                  ? <><span style={{ fontWeight: 600 }}>{v.brand}</span>{v.brand && v.model ? " " : ""}{v.model}</>
                  : <span style={{ color: "#94a3b8" }}>—</span>}
              </td>
              <td style={{ padding: "12px 16px", textTransform: "capitalize" }}>{v.type}</td>
              <td style={{ padding: "12px 16px", color: v.hub ? "#1C1917" : "#A8A29E", fontSize: 13 }}>{v.hub ?? "—"}</td>
              <td style={{ padding: "12px 16px", color: v.leaseCompany ? "#1C1917" : "#A8A29E", fontSize: 13 }}>{v.leaseCompany ?? "—"}</td>
              <td style={{ padding: "12px 16px" }}>
                <select
                  value={v.status}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    if (newStatus === "non_operational") {
                      setNonOpVehicle(v);
                    } else {
                      updateStatus(v.id, newStatus);
                    }
                  }}
                  style={{
                    background: statusColor[v.status] + "22",
                    color: statusColor[v.status],
                    border: `1px solid ${statusColor[v.status]}44`,
                    borderRadius: 12,
                    padding: "2px 10px",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {Object.entries(statusLabel).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </td>
              <td style={{ padding: "12px 16px" }}>
                <span
                  style={{ position: "relative", display: "inline-block" }}
                  onMouseEnter={() => v.nonOperationalReason && setHoveredReasonId(v.id)}
                  onMouseLeave={() => setHoveredReasonId((id) => (id === v.id ? null : id))}
                >
                  <span
                    style={{
                      color: v.nonOperationalBy ? "#DC2626" : "#A8A29E", fontSize: 13, fontWeight: v.nonOperationalBy ? 600 : 400,
                      cursor: v.nonOperationalReason ? "help" : "default",
                      textDecoration: v.nonOperationalReason ? "underline dotted" : "none",
                      textUnderlineOffset: 3,
                    }}
                  >
                    {v.nonOperationalBy ?? "—"}
                  </span>
                  {hoveredReasonId === v.id && v.nonOperationalReason && (
                    <div
                      style={{
                        position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30,
                        background: "#1C1917", color: "#fff", fontSize: 12, fontWeight: 500,
                        padding: "8px 12px", borderRadius: 8, width: 220, whiteSpace: "normal",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.2)", lineHeight: 1.4,
                      }}
                    >
                      {v.nonOperationalReason}
                    </div>
                  )}
                </span>
              </td>
              <td style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {!showArchived && (
                    <>
                      <button
                        onClick={() => setEditingVehicle(v)}
                        style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #E7E5E4", background: "#FAF9F7", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#57534E", fontFamily: "inherit" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setSelectedVehicle(v)}
                        style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #E7E5E4", background: "#FAF9F7", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#57534E", fontFamily: "inherit" }}
                      >
                        Maintenance Log
                      </button>
                      {v.status === "in_maintenance" && (
                        <button
                          onClick={() => setReplacementVehicle(v)}
                          style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #FED7AA", background: "#FFF7ED", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#C2410C", fontFamily: "inherit" }}
                        >
                          Replacement
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => v.archived ? unarchiveVehicle(v.id) : archiveVehicle(v.id)}
                    style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${v.archived ? "#22c55e44" : "#ef444444"}`, background: v.archived ? "#f0fdf4" : "#fff5f5", fontSize: 12, fontWeight: 600, cursor: "pointer", color: v.archived ? "#16a34a" : "#ef4444" }}
                  >
                    {v.archived ? "Restore" : "Archive"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {showAddModal && (
        <AddVehicleModal onClose={() => setShowAddModal(false)} onAdded={() => load()} />
      )}

      {selectedVehicle && (
        <MaintenanceDrawer vehicle={selectedVehicle} onClose={() => setSelectedVehicle(null)} />
      )}

      {replacementVehicle && (
        <ReplacementVehicleModal vehicle={replacementVehicle} onClose={() => setReplacementVehicle(null)} />
      )}

      {nonOpVehicle && (
        <MarkNonOperationalModal
          vehicle={nonOpVehicle}
          onClose={() => setNonOpVehicle(null)}
          onConfirmed={() => { setNonOpVehicle(null); load(); }}
        />
      )}

      {editingVehicle && (
        <VehicleEditDrawer
          vehicle={editingVehicle}
          onClose={() => setEditingVehicle(null)}
          onSaved={(updated) => {
            setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
            setEditingVehicle(null);
          }}
        />
      )}
    </div>
  );
}
