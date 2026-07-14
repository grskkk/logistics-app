import { useEffect, useState } from "react";
import type { Vehicle } from "@logistics/shared";
import { api } from "../api/client";

const statCard = (label: string, value: number, color: string): React.CSSProperties => ({
  background: "#fff", borderRadius: 10, padding: "20px 24px",
  boxShadow: "0 1px 3px rgba(0,0,0,.06)", flex: "1 1 130px",
  borderLeft: `4px solid ${color}`,
});

const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 800, color: "#A8A29E",
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12,
};

export default function Dashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    api.get<Vehicle[]>("/vehicles?archived=false").then(setVehicles).catch(console.error);
  }, []);

  const vByStatus = {
    operational: vehicles.filter((v) => v.status === "operational").length,
    in_maintenance: vehicles.filter((v) => v.status === "in_maintenance").length,
    non_operational: vehicles.filter((v) => v.status === "non_operational").length,
  };

  const vByType = {
    van: vehicles.filter((v) => v.type === "van").length,
    truck: vehicles.filter((v) => v.type === "truck").length,
    bike: vehicles.filter((v) => v.type === "bike").length,
  };

  const maintenanceVehicles = vehicles.filter((v) => v.status === "in_maintenance");

  return (
    <div className="page">
      <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, color: "#1C1917" }}>Dashboard</h1>
      <p style={{ color: "#78716C", marginBottom: 32, fontSize: 14 }}>Fleet overview</p>

      {/* Fleet summary */}
      <div style={sectionTitle}>Fleet — {vehicles.length} vehicles</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
        <div style={statCard("Operational", vByStatus.operational, "#16A34A")}>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#1C1917" }}>{vByStatus.operational}</div>
          <div style={{ color: "#78716C", fontSize: 13, marginTop: 2 }}>Operational</div>
        </div>
        <div style={statCard("In Maintenance", vByStatus.in_maintenance, "#CA8A04")}>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#1C1917" }}>{vByStatus.in_maintenance}</div>
          <div style={{ color: "#78716C", fontSize: 13, marginTop: 2 }}>In Maintenance</div>
        </div>
        <div style={statCard("Non Operational", vByStatus.non_operational, "#DC2626")}>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#1C1917" }}>{vByStatus.non_operational}</div>
          <div style={{ color: "#78716C", fontSize: 13, marginTop: 2 }}>Non Operational</div>
        </div>
      </div>

      {/* By type */}
      <div style={{ maxWidth: 320, background: "#fff", borderRadius: 10, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.06)", marginBottom: 32 }}>
        <div style={sectionTitle}>By Type</div>
        {[["Van", vByType.van, "#D97757"], ["Truck", vByType.truck, "#1C1917"], ["Bike", vByType.bike, "#CA8A04"]].map(([label, count, color]) => (
          <div key={label as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F5F5F4" }}>
            <span style={{ fontWeight: 700, color: "#1C1917" }}>{label as string}</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: color as string }}>{count as number}</span>
          </div>
        ))}
      </div>

      {/* Maintenance alerts */}
      {maintenanceVehicles.length > 0 && (
        <>
          <div style={sectionTitle}>In Maintenance</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {maintenanceVehicles.map((v) => (
              <div key={v.id} style={{ background: "#fff", borderRadius: 10, padding: "14px 20px", boxShadow: "0 1px 3px rgba(0,0,0,.06)", display: "flex", alignItems: "center", gap: 16, borderLeft: "4px solid #CA8A04" }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 800, color: "#1C1917" }}>{v.licensePlate}</span>
                  {(v.brand || v.model) && <span style={{ color: "#A8A29E", marginLeft: 8, fontSize: 13 }}>{v.brand} {v.model}</span>}
                </div>
                <span style={{ fontSize: 13, color: "#78716C", textTransform: "capitalize" }}>{v.type}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
