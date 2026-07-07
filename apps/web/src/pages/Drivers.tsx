import { useEffect, useState } from "react";
import type { Driver, DriverStatus, Vehicle } from "@logistics/shared";
import { api } from "../api/client";
import AddDriverModal from "../components/AddDriverModal";
import DriverEditModal from "../components/DriverEditModal";

const statusColor: Record<DriverStatus, string> = {
  available: "#16A34A",
  on_duty: "#D97757",
  offline: "#A8A29E",
};

const statusLabel: Record<DriverStatus, string> = {
  available: "Available",
  on_duty: "On Duty",
  offline: "Offline",
};

export default function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const load = () => {
    api.get<Driver[]>("/drivers").then(setDrivers).catch(console.error);
    api.get<Vehicle[]>("/vehicles?archived=false").then(setVehicles).catch(console.error);
  };

  useEffect(load, []);

  const updateStatus = async (id: number, status: string) => {
    await api.put(`/drivers/${id}`, { status });
    load();
  };

  const vehicleMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#1C1917" }}>Drivers</h1>
          <p style={{ margin: "4px 0 0", color: "#78716C", fontSize: 14 }}>Manage your driver roster</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ padding: "8px 20px", borderRadius: 8, background: "#D97757", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
        >
          + Add Driver
        </button>
      </div>

      <div className="table-wrapper">
      <table>
        <thead>
          <tr style={{ background: "#FAF9F7", textAlign: "left", borderBottom: "1px solid #E7E5E4" }}>
            <th style={{ padding: "12px 16px", fontWeight: 700, color: "#57534E", fontSize: 13 }}>Name</th>
            <th style={{ padding: "12px 16px", fontWeight: 700, color: "#57534E", fontSize: 13 }}>Email</th>
            <th style={{ padding: "12px 16px", fontWeight: 700, color: "#57534E", fontSize: 13 }}>Phone</th>
            <th style={{ padding: "12px 16px", fontWeight: 700, color: "#57534E", fontSize: 13 }}>Status</th>
            <th style={{ padding: "12px 16px", fontWeight: 700, color: "#57534E", fontSize: 13 }}>Assigned Vehicle</th>
            <th style={{ padding: "12px 16px" }}></th>
          </tr>
        </thead>
        <tbody>
          {drivers.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#A8A29E" }}>No drivers yet. Add your first driver.</td></tr>
          )}
          {drivers.map((d) => {
            const vehicle = d.vehicleId ? vehicleMap[d.vehicleId] : null;
            return (
              <tr key={d.id} style={{ borderTop: "1px solid #F5F5F4" }}>
                <td style={{ padding: "12px 16px", fontWeight: 700, color: "#1C1917" }}>{d.name}</td>
                <td style={{ padding: "12px 16px", color: "#78716C" }}>{d.email}</td>
                <td style={{ padding: "12px 16px", color: "#78716C" }}>{d.phone}</td>
                <td style={{ padding: "12px 16px" }}>
                  <select
                    value={d.status}
                    onChange={(e) => updateStatus(d.id, e.target.value)}
                    style={{
                      background: statusColor[d.status] + "18",
                      color: statusColor[d.status],
                      border: `1px solid ${statusColor[d.status]}44`,
                      borderRadius: 20,
                      padding: "3px 10px",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {(Object.entries(statusLabel) as [DriverStatus, string][]).map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {vehicle ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 700, color: "#1C1917" }}>{vehicle.licensePlate}</span>
                      {(vehicle.brand || vehicle.model) && (
                        <span style={{ color: "#A8A29E", fontSize: 13 }}>· {vehicle.brand} {vehicle.model}</span>
                      )}
                    </span>
                  ) : (
                    <span style={{ color: "#A8A29E" }}>Unassigned</span>
                  )}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <button
                    onClick={() => setEditingDriver(d)}
                    style={{ padding: "4px 14px", borderRadius: 6, border: "1px solid #E7E5E4", background: "#FAF9F7", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#57534E", fontFamily: "inherit" }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      </div>

      {showAddModal && (
        <AddDriverModal onClose={() => setShowAddModal(false)} onAdded={load} />
      )}

      {editingDriver && (
        <DriverEditModal
          driver={editingDriver}
          onClose={() => setEditingDriver(null)}
          onSaved={(updated) => {
            setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
            setEditingDriver(null);
          }}
        />
      )}
    </div>
  );
}
