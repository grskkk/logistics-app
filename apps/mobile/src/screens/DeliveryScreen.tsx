import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import type { Shipment, ShipmentStatus } from "@logistics/shared";

const API_URL = "http://localhost:3001/api";

const NEXT_STATUS: Partial<Record<ShipmentStatus, ShipmentStatus>> = {
  pending: "picked_up",
  picked_up: "in_transit",
  in_transit: "delivered",
};

export default function DeliveryScreen() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch(`${API_URL}/shipments`)
      .then((r) => r.json())
      .then(setShipments)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const advance = async (shipment: Shipment) => {
    const next = NEXT_STATUS[shipment.status];
    if (!next) return;
    await fetch(`${API_URL}/shipments/${shipment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    load();
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>All Shipments</Text>
      <FlatList
        data={shipments}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.tracking}>{item.trackingNumber}</Text>
            <Text style={styles.status}>{item.status.replace("_", " ")}</Text>
            {NEXT_STATUS[item.status] && (
              <TouchableOpacity style={styles.btn} onPress={() => advance(item)}>
                <Text style={styles.btnText}>Mark as {NEXT_STATUS[item.status]!.replace("_", " ")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f8fafc" },
  heading: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tracking: { fontFamily: "monospace", fontWeight: "700", fontSize: 14, marginBottom: 4 },
  status: { color: "#64748b", textTransform: "capitalize", marginBottom: 8 },
  btn: { backgroundColor: "#3b82f6", borderRadius: 8, padding: 10, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600", textTransform: "capitalize" },
});
