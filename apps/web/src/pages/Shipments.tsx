import { useEffect, useState } from "react";
import type { Shipment } from "@logistics/shared";
import { api } from "../api/client";

const statusColor: Record<string, string> = {
  pending: "#A8A29E",
  picked_up: "#CA8A04",
  in_transit: "#D97757",
  delivered: "#16A34A",
  failed: "#DC2626",
};

export default function Shipments() {
  const [shipments, setShipments] = useState<Shipment[]>([]);

  useEffect(() => {
    api.get<Shipment[]>("/shipments").then(setShipments).catch(console.error);
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#1C1917" }}>Shipments</h1>
          <p style={{ margin: "4px 0 0", color: "#78716C", fontSize: 14 }}>Track and manage all shipments</p>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr style={{ background: "#FAF9F7", textAlign: "left", borderBottom: "1px solid #E7E5E4" }}>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "#57534E", fontSize: 13 }}>Tracking #</th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "#57534E", fontSize: 13 }}>Status</th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "#57534E", fontSize: 13 }}>Origin</th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "#57534E", fontSize: 13 }}>Destination</th>
              <th style={{ padding: "12px 16px", fontWeight: 700, color: "#57534E", fontSize: 13 }}>Est. Delivery</th>
            </tr>
          </thead>
          <tbody>
            {shipments.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#A8A29E" }}>No shipments yet.</td></tr>
            )}
            {shipments.map((s) => (
              <tr key={s.id} style={{ borderTop: "1px solid #F5F5F4" }}>
                <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: "#1C1917" }}>{s.trackingNumber}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ background: statusColor[s.status] + "22", color: statusColor[s.status], padding: "2px 10px", borderRadius: 20, fontWeight: 700, fontSize: 12 }}>
                    {s.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td style={{ padding: "12px 16px", color: "#78716C" }}>{s.origin.address ?? `${s.origin.lat}, ${s.origin.lng}`}</td>
                <td style={{ padding: "12px 16px", color: "#78716C" }}>{s.destination.address ?? `${s.destination.lat}, ${s.destination.lng}`}</td>
                <td style={{ padding: "12px 16px", color: "#78716C" }}>{s.estimatedDelivery ? new Date(s.estimatedDelivery).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
