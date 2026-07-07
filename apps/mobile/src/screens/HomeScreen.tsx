import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import type { Shipment } from "@logistics/shared";

const API_URL = "http://localhost:3001/api";

export default function HomeScreen() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/shipments`)
      .then((r) => r.json())
      .then((data) => setShipments(data.filter((s: Shipment) => s.status !== "delivered")))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Active Deliveries</Text>
      <FlatList
        data={shipments}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.tracking}>{item.trackingNumber}</Text>
            <Text style={styles.status}>{item.status.replace("_", " ")}</Text>
            <Text style={styles.dest}>To: {item.destination.address ?? `${item.destination.lat}, ${item.destination.lng}`}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No active deliveries.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f8fafc" },
  heading: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tracking: { fontFamily: "monospace", fontWeight: "700", fontSize: 14, marginBottom: 4 },
  status: { color: "#3b82f6", fontWeight: "600", marginBottom: 4, textTransform: "capitalize" },
  dest: { color: "#64748b", fontSize: 13 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
});
